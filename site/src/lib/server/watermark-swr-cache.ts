/**
 * Stale-while-revalidate memo for expensive server computations whose freshness
 * is decided by a WATERMARK string rather than a clock TTL (LD: the daily
 * log-rollup finalization day, `db_metadata.log_rollup_finalized_through`).
 *
 * The dashboard problem it solves: better-sqlite3 blocks the event loop for the
 * whole calculation, and the operator visits far less often than any sane TTL —
 * so an expire-then-recompute cache makes nearly every human load pay full
 * price, while every other request waits behind it. Here the last successful
 * value returns INSTANTLY; when the watermark moves, the first request after
 * that schedules exactly one background refresh (next tick, after the stale
 * response has gone out).
 *
 * Deliberately knows nothing about analytics payloads, databases or logging —
 * the caller owns the key, the watermark reader, the computation, the failure
 * logger, the on-hit projection and (optionally) the durable store.
 *
 * ── CANONICAL SHAPE (2026-07-27) ───────────────────────────────────────────
 * This file is copy-paste-shared BY SHAPE with house + living-dictionaries.
 * It drifted within a week of being extracted into all three (three method
 * names, three option shapes, and one genuine semantic contradiction about
 * when the watermark is read). The 2026-07-26 cross-app review settled it:
 *
 *   - house's IMPLEMENTATION — single-flighted async misses, disk persistence,
 *     `settle()` — because that is what production needed;
 *   - living-dictionaries' ORDERING — read the watermark BEFORE the compute.
 *     Reading it after stamps a value computed from pre-advance data with the
 *     post-advance watermark, so it looks current and never refreshes. Reading
 *     before can only ever make an entry look stale, which self-corrects;
 *   - ONE method name (`get_or_schedule` + its `_async` twin), ONE option shape
 *     (`read_watermark` / `on_background_error` / `schedule` / `persistence`),
 *     and the UNION of the three repos' tests in `watermark-swr-cache.test.ts`.
 *
 * That test IS the shared behavioral contract — port a fix here to all three.
 */

/** Why a computation is running: a cold `miss` (in the caller's path) or a background `refresh`. */
export type WatermarkComputeReason = 'miss' | 'refresh'

export interface CacheEntry<T> {
  watermark: string | null
  value: T
}

/**
 * Optional durable backing for the in-memory map — survives process restarts so
 * a deploy doesn't force a cold recompute. `load` must return `null` for
 * anything it can't vouch for (missing, unreadable, wrong payload format).
 * See `./watermark-cache-file-store.ts` for the JSON-file implementation.
 */
export interface WatermarkSwrPersistence<T> {
  load: (key: string) => CacheEntry<T> | null
  save: (key: string, entry: CacheEntry<T>) => void
  /**
   * Drop a key's durable copy. Called by `clear()`, which means "these values
   * are WRONG" (an admin edited the underlying data, a test tore the DB down) —
   * without this the very next read would serve the invalidated payload straight
   * back off disk. Optional so a memory-only store can skip it.
   */
  remove?: (key: string) => void
}

export interface WatermarkSwrCacheOptions<T> {
  /** Current watermark for every key. `null` (e.g. dev, where the rollup cron never runs) is valid. */
  read_watermark: () => string | null
  /** A background refresh or a persistence read/write threw — the caller decides how to log it. Never called for a `miss` (that throw propagates). */
  on_background_error: (error: Error) => void
  /** Test seam: how background work is deferred. Default `setTimeout(run, 0)`. */
  schedule?: (run: () => void) => void
  /** Durable mirror of the in-memory map. Default: none (memory only). */
  persistence?: WatermarkSwrPersistence<T> | null
}

interface GetOptions<T> {
  key: string
  compute: (context: { reason: WatermarkComputeReason }) => T
  /**
   * Splice always-fresh fields onto a CACHED value before returning it (the
   * pipeline-liveness panel — "is ingest broken RIGHT NOW?" must never be
   * answered from a day-old blob). Not applied to a fresh `miss` compute, which
   * is already live, and not applied to what gets stored.
   */
  project?: (value: T) => T
}

interface GetAsyncOptions<T> {
  key: string
  compute: (context: { reason: WatermarkComputeReason }) => Promise<T>
  project?: (value: T) => T
  /**
   * `false` = wait for a current value instead of serving a stale one. For an
   * INPUT to another compute (house: the shared base a page tier builds on) —
   * a refresh that quietly rebuilt itself from stale inputs would publish a
   * "fresh" payload with old numbers in it.
   */
  allow_stale?: boolean
}

export class WatermarkSwrCache<T> {
  #entries = new Map<string, CacheEntry<T>>()
  /** Per-key single-flight token; the symbol identity survives a `clear()` that wipes the map. */
  #refreshing = new Map<string, symbol>()
  /** Per-key in-flight async compute — every waiter adopts the same promise. */
  #in_flight = new Map<string, Promise<T>>()
  /**
   * Bumped by `clear()` so a refresh started before the clear can never
   * repopulate the emptied cache (the invalidation it raced was there for a
   * reason — schema change, test teardown, fresh DB handle).
   */
  #generation = 0
  #read_watermark: () => string | null
  #on_background_error: (error: Error) => void
  #schedule: (run: () => void) => void
  #persistence: WatermarkSwrPersistence<T> | null

  constructor({ read_watermark, on_background_error, schedule, persistence = null }: WatermarkSwrCacheOptions<T>) {
    this.#read_watermark = read_watermark
    this.#on_background_error = on_background_error
    this.#schedule = schedule ?? ((run) => { setTimeout(run, 0) })
    this.#persistence = persistence
  }

  /**
   * Cached value if one exists (scheduling one background refresh when the
   * watermark has moved), otherwise compute it now and cache it. With
   * `persistence` wired, a miss first tries the last value written to disk and
   * serves it stale-but-instant rather than paying a cold recompute after every
   * deploy. A `miss` computation runs in the caller's path and its throw
   * propagates — nothing is cached from a failed compute.
   */
  get_or_schedule({ key, compute, project }: GetOptions<T>): T {
    const watermark = this.#read_watermark()
    const hit = this.#entries.get(key) ?? this.#load_persisted(key)
    if (hit) {
      if (hit.watermark !== watermark)
        this.#schedule_refresh({ key, compute })
      return project ? project(hit.value) : hit.value
    }
    const value = compute({ reason: 'miss' })
    this.#store({ key, entry: { watermark, value } })
    return value
  }

  /**
   * The async twin — use this for anything expensive enough to matter. Three
   * differences that each cost production time before 2026-07-26:
   *
   *   - **single-flighted misses**: concurrent first callers adopt ONE compute
   *     (two simultaneous first visits each ran the whole 27–33 s calculation);
   *   - **durable fallback**: with `persistence`, a miss serves the last value
   *     written to disk and refreshes behind it (five deploys in a day each
   *     handed the next visitor a cold recompute);
   *   - **cooperative compute**: `compute` is a promise, so an implementation
   *     that yields the event loop between stages (see `./breathe.ts`) keeps
   *     the process responsive while it runs.
   */
  async get_or_schedule_async({ key, compute, project, allow_stale = true }: GetAsyncOptions<T>): Promise<T> {
    const watermark = this.#read_watermark()
    const hit = this.#entries.get(key) ?? this.#load_persisted(key)
    if (hit && (allow_stale || hit.watermark === watermark)) {
      if (hit.watermark !== watermark)
        this.#schedule_async_refresh({ key, compute })
      return project ? project(hit.value) : hit.value
    }
    // A freshly computed value is live by definition — never projected.
    return await this.refresh_async({ key, compute })
  }

  /** Recompute + store now, adopting any compute already in flight for the key. */
  refresh_async({ key, compute }: { key: string, compute: (context: { reason: WatermarkComputeReason }) => Promise<T> }): Promise<T> {
    const in_flight = this.#in_flight.get(key)
    if (in_flight)
      return in_flight
    return this.#run_compute({ key, compute, reason: this.#entries.has(key) ? 'refresh' : 'miss' })
  }

  /**
   * Await every compute currently in flight (started by a caller or by a
   * scheduled background refresh). The seam a test — or a warm-up job that
   * wants to know the cache is armed — uses instead of guessing how many
   * event-loop turns a chunked compute needs.
   */
  async settle(): Promise<void> {
    await Promise.allSettled([...this.#in_flight.values()])
  }

  /**
   * Drop every entry. Generation-safe: any refresh already in flight finishes
   * but its result is discarded, so an invalidated calculation can't repopulate
   * the cache with pre-invalidation data.
   */
  clear(): void {
    // Invalidate the durable copies of everything we're holding FIRST — a
    // `clear()` means the values are wrong, and a persisted entry left on disk
    // would be served straight back on the next read (caught by tutor's
    // "invalidated in-flight refresh" test, 2026-07-27).
    if (this.#persistence?.remove) {
      for (const key of this.#entries.keys()) {
        try {
          this.#persistence.remove(key)
        } catch (error) {
          this.#on_background_error(error as Error)
        }
      }
    }
    this.#entries.clear()
    this.#refreshing.clear()
    this.#in_flight.clear()
    this.#generation += 1
  }

  /** Keys currently holding an in-memory value — diagnostics/tests only. */
  get size(): number {
    return this.#entries.size
  }

  async #run_compute({ key, compute, reason, generation = this.#generation }: {
    key: string
    compute: (context: { reason: WatermarkComputeReason }) => Promise<T>
    reason: WatermarkComputeReason
    /**
     * The generation this work BELONGS to. A scheduled refresh passes the
     * generation it was scheduled in, not the one it happens to start in —
     * otherwise a `clear()` between "stale read schedules a refresh" and "the
     * refresh actually runs" is invisible to the guard, and the invalidated
     * result repopulates the cache anyway (caught by LD's
     * `log-analytics-cache` suite, 2026-07-27).
     */
    generation?: number
  }): Promise<T> {
    // Read BEFORE computing: a watermark that advances mid-compute must leave
    // the entry stale (it refreshes again) rather than look current.
    const watermark = this.#read_watermark()
    const promise = compute({ reason })
    this.#in_flight.set(key, promise)
    try {
      const value = await promise
      if (generation === this.#generation)
        this.#store({ key, entry: { watermark, value } })
      return value
    } finally {
      if (this.#in_flight.get(key) === promise)
        this.#in_flight.delete(key)
    }
  }

  #store({ key, entry }: { key: string, entry: CacheEntry<T> }): void {
    this.#entries.set(key, entry)
    if (!this.#persistence)
      return
    try {
      this.#persistence.save(key, entry)
    } catch (error) {
      // A durable-write failure must never break the request that computed a
      // perfectly good value — the in-memory entry stands on its own.
      this.#on_background_error(error as Error)
    }
  }

  #load_persisted(key: string): CacheEntry<T> | null {
    if (!this.#persistence)
      return null
    try {
      const entry = this.#persistence.load(key)
      if (entry)
        this.#entries.set(key, entry)
      return entry
    } catch (error) {
      this.#on_background_error(error as Error)
      return null
    }
  }

  #schedule_refresh({ key, compute }: { key: string, compute: (context: { reason: WatermarkComputeReason }) => T }): void {
    if (this.#refreshing.has(key))
      return
    const token = Symbol(key)
    const generation = this.#generation
    this.#refreshing.set(key, token)
    this.#schedule(() => {
      try {
        // Read BEFORE computing — see `#run_compute`.
        const watermark = this.#read_watermark()
        const value = compute({ reason: 'refresh' })
        if (generation === this.#generation)
          this.#store({ key, entry: { watermark, value } })
      } catch (error) {
        // The last good value stays cached; the next request retries.
        this.#on_background_error(error as Error)
      } finally {
        // Only clear OUR flight — a `clear()` mid-flight may already have let a
        // newer refresh take the key.
        if (this.#refreshing.get(key) === token)
          this.#refreshing.delete(key)
      }
    })
  }

  #schedule_async_refresh({ key, compute }: { key: string, compute: (context: { reason: WatermarkComputeReason }) => Promise<T> }): void {
    if (this.#refreshing.has(key) || this.#in_flight.has(key))
      return
    const token = Symbol(key)
    const generation = this.#generation
    this.#refreshing.set(key, token)
    this.#schedule(() => {
      this.#run_compute({ key, compute, reason: 'refresh', generation })
        .catch(error => this.#on_background_error(error as Error))
        .finally(() => {
          if (this.#refreshing.get(key) === token)
            this.#refreshing.delete(key)
        })
    })
  }
}
