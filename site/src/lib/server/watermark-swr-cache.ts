/**
 * Stale-while-revalidate memo for expensive, synchronous server computations
 * whose freshness is decided by a coarse **watermark** string (LD: the daily
 * log-rollup finalization day) rather than a clock TTL.
 *
 * The dashboard problem it solves: better-sqlite3 blocks the event loop for the
 * whole calculation, and the operator visits far less often than any sane TTL —
 * so an expire-then-recompute cache makes nearly every human load pay full
 * price. Here the last successful value returns INSTANTLY; when the watermark
 * moves, the first request after that schedules exactly one background refresh
 * (next tick, after the stale response has gone out).
 *
 * Deliberately knows nothing about analytics payloads, databases, or logging —
 * the caller supplies the key, the watermark reader, the computation, the
 * failure logger, and (optionally) a projection of always-fresh fields onto a
 * cached hit. This file is copy-paste-shared with tutor/house: same API, same
 * behavioral tests, app-specific everything else.
 */

/** Why a computation is running: a cold `miss` (in the caller's path) or a background `refresh`. */
export type WatermarkComputeReason = 'miss' | 'refresh'

interface WatermarkSwrCacheOptions {
  /** Current watermark for every key. `null` (e.g. dev, where the rollup cron never runs) is a valid value. */
  read_watermark: () => string | null
  /** A background refresh threw — the caller decides how to log it. Never called for a `miss` (that throw propagates). */
  on_background_error: (error: Error) => void
  /** Test seam: how background work is deferred. Default `setTimeout(run, 0)`. */
  schedule?: (run: () => void) => void
}

interface GetOrScheduleOptions<T> {
  key: string
  compute: (context: { reason: WatermarkComputeReason }) => T
  /**
   * Splice always-fresh fields onto a CACHED value before returning it (LD: the
   * pipeline-liveness panel — "is ingest broken RIGHT NOW?" must never be
   * answered from a day-old blob). Not applied to a fresh `miss` compute, which
   * is already live, and not applied to what gets stored.
   */
  project?: (value: T) => T
}

export class WatermarkSwrCache<T> {
  #entries = new Map<string, { watermark: string | null, value: T }>()
  /** Per-key single-flight token; the symbol identity survives a `clear()` that wipes the map. */
  #refreshing = new Map<string, symbol>()
  /** Bumped by `clear()` so an in-flight refresh started before it can never repopulate. */
  #generation = 0
  #read_watermark: () => string | null
  #on_background_error: (error: Error) => void
  #schedule: (run: () => void) => void

  constructor({ read_watermark, on_background_error, schedule }: WatermarkSwrCacheOptions) {
    this.#read_watermark = read_watermark
    this.#on_background_error = on_background_error
    this.#schedule = schedule ?? ((run) => { setTimeout(run, 0) })
  }

  /**
   * Cached value if one exists (scheduling one background refresh when the
   * watermark has moved), otherwise compute it now and cache it. A `miss`
   * computation runs in the caller's path and its throw propagates — nothing is
   * cached from a failed compute.
   */
  get_or_schedule({ key, compute, project }: GetOrScheduleOptions<T>): T {
    const watermark = this.#read_watermark()
    const hit = this.#entries.get(key)
    if (hit) {
      if (hit.watermark !== watermark)
        this.#schedule_refresh({ key, compute })
      return project ? project(hit.value) : hit.value
    }
    const value = compute({ reason: 'miss' })
    this.#entries.set(key, { watermark, value })
    return value
  }

  /**
   * Drop every entry. Generation-safe: any refresh already in flight finishes
   * but its result is discarded, so an invalidated calculation can't repopulate
   * the cache with pre-invalidation data.
   */
  clear(): void {
    this.#entries.clear()
    this.#refreshing.clear()
    this.#generation += 1
  }

  /** Keys currently holding a value — diagnostics/tests only. */
  get size(): number {
    return this.#entries.size
  }

  #schedule_refresh({ key, compute }: { key: string, compute: (context: { reason: WatermarkComputeReason }) => T }): void {
    if (this.#refreshing.has(key))
      return
    const token = Symbol(key)
    const generation = this.#generation
    this.#refreshing.set(key, token)
    this.#schedule(() => {
      try {
        // Read BEFORE computing: a watermark that advances mid-compute must leave
        // the entry stale (it would refresh again) rather than look current.
        const watermark = this.#read_watermark()
        const value = compute({ reason: 'refresh' })
        if (generation === this.#generation)
          this.#entries.set(key, { watermark, value })
      } catch (error) {
        this.#on_background_error(error as Error)
      } finally {
        // Only clear OUR flight — a `clear()` mid-flight may already have let a
        // newer refresh take the key.
        if (this.#refreshing.get(key) === token)
          this.#refreshing.delete(key)
      }
    })
  }
}
