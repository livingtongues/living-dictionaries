import type { CacheEntry, WatermarkSwrPersistence } from './watermark-swr-cache'
import { WatermarkSwrCache } from './watermark-swr-cache'

/**
 * THE shared behavioral contract for the stale-while-revalidate controller —
 * the UNION of the three suites house, tutor and living-dictionaries each grew
 * separately (2026-07-27 convergence). Every case here is a bug one of the
 * hand-rolled copies could have regressed into. Keep all three copies identical;
 * a fix in one ports mechanically.
 */
describe(WatermarkSwrCache, () => {
  /** Deferred refreshes run only when the test says so. */
  function build({ watermark = 'day-1', persistence = null }: {
    watermark?: string | null
    persistence?: WatermarkSwrPersistence<string> | null
  } = {}) {
    const pending: (() => void)[] = []
    const errors: Error[] = []
    const state = { watermark }
    const cache = new WatermarkSwrCache<string>({
      read_watermark: () => state.watermark,
      on_background_error: error => errors.push(error),
      schedule: run => pending.push(run),
      persistence,
    })
    const run_pending = (): void => {
      const queued = pending.splice(0, pending.length)
      for (const run of queued) run()
    }
    return { cache, state, pending, errors, run_pending }
  }

  /** An in-memory `WatermarkSwrPersistence` that records what it was asked to do. */
  function memory_store(seed: Record<string, CacheEntry<string>> = {}) {
    const saved = new Map<string, CacheEntry<string>>(Object.entries(seed))
    const loads: string[] = []
    const saves: string[] = []
    const store: WatermarkSwrPersistence<string> = {
      load(key) {
        loads.push(key)
        return saved.get(key) ?? null
      },
      save(key, entry) {
        saves.push(key)
        saved.set(key, entry)
      },
    }
    return { store, saved, loads, saves }
  }

  // ── Synchronous path ─────────────────────────────────────────────────────

  test('cold miss computes in the caller path and caches the result', () => {
    const { cache, pending } = build()
    const reasons: string[] = []

    const value = cache.get_or_schedule({ key: 'a', compute: ({ reason }) => { reasons.push(reason); return 'first' } })

    expect(value).toBe('first')
    expect(reasons).toEqual(['miss'])
    expect(pending).toHaveLength(0)
    expect(cache.size).toBe(1)
  })

  test('fresh hit returns the cached value without recomputing or scheduling', () => {
    const { cache, pending } = build()
    let computes = 0
    const compute = (): string => `value-${++computes}`

    cache.get_or_schedule({ key: 'a', compute })
    const second = cache.get_or_schedule({ key: 'a', compute })

    expect(second).toBe('value-1')
    expect(computes).toBe(1)
    expect(pending).toHaveLength(0)
  })

  test('stale hit returns the old value immediately and refreshes in the background', () => {
    const { cache, state, run_pending } = build()
    let computes = 0
    const compute = (): string => `value-${++computes}`

    cache.get_or_schedule({ key: 'a', compute })
    state.watermark = 'day-2'
    expect(cache.get_or_schedule({ key: 'a', compute })).toBe('value-1')
    expect(computes).toBe(1)

    run_pending()

    expect(computes).toBe(2)
    expect(cache.get_or_schedule({ key: 'a', compute })).toBe('value-2')
    expect(computes).toBe(2)
  })

  test('a refreshed entry is stamped with the watermark its value reflects', () => {
    const { cache, state, run_pending, pending } = build()
    let computes = 0
    const compute = (): string => `value-${++computes}`

    cache.get_or_schedule({ key: 'a', compute })
    state.watermark = 'day-2'
    cache.get_or_schedule({ key: 'a', compute })
    run_pending()

    // Still on day-2 → the refreshed entry is fresh, so nothing new is scheduled.
    cache.get_or_schedule({ key: 'a', compute })
    expect(pending).toHaveLength(0)
    expect(computes).toBe(2)
  })

  test('the watermark is read BEFORE the compute, so an advance mid-compute leaves the entry stale', () => {
    // The one genuine semantic disagreement between the three copies, settled
    // 2026-07-26 in living-dictionaries' favour: reading the watermark AFTER
    // the compute stamps a value built from pre-advance data with the
    // post-advance watermark — it looks current and never refreshes again.
    const { cache, state, pending, run_pending } = build()
    const computes: string[] = []
    const compute = ({ reason }: { reason: string }): string => {
      computes.push(reason)
      // The rollup cron advances the watermark WHILE this refresh computes.
      if (reason === 'refresh' && computes.length === 2)
        state.watermark = 'day-3'
      return `value-${computes.length}`
    }

    cache.get_or_schedule({ key: 'a', compute })
    state.watermark = 'day-2'
    cache.get_or_schedule({ key: 'a', compute })
    run_pending()

    // The entry was stamped day-2 (its inputs), so the next read sees day-3 and
    // schedules another refresh instead of trusting a value it never reflected.
    cache.get_or_schedule({ key: 'a', compute })
    expect(pending).toHaveLength(1)
    run_pending()
    expect(computes).toEqual(['miss', 'refresh', 'refresh'])
  })

  test('a projector decorates cached hits only, never the fresh compute or the stored value', () => {
    const { cache } = build()

    const fresh = cache.get_or_schedule({ key: 'a', compute: () => 'base', project: value => `${value}+live` })
    expect(fresh).toBe('base')

    const hit = cache.get_or_schedule({ key: 'a', compute: () => 'base', project: value => `${value}+live` })
    expect(hit).toBe('base+live')

    // The projection was not written back into the cache.
    expect(cache.get_or_schedule({ key: 'a', compute: () => 'unused' })).toBe('base')
  })

  test('concurrent stale reads schedule exactly one refresh (single-flight per key)', () => {
    const { cache, state, pending, run_pending } = build()
    const reasons: string[] = []
    const compute = ({ reason }: { reason: string }): string => { reasons.push(reason); return `value-${reasons.length}` }

    cache.get_or_schedule({ key: 'a', compute })
    state.watermark = 'day-2'
    cache.get_or_schedule({ key: 'a', compute })
    cache.get_or_schedule({ key: 'a', compute })
    cache.get_or_schedule({ key: 'a', compute })

    expect(pending).toHaveLength(1)

    run_pending()

    expect(reasons).toEqual(['miss', 'refresh'])

    // The token is released, so a later staleness schedules a fresh refresh.
    state.watermark = 'day-3'
    cache.get_or_schedule({ key: 'a', compute })
    expect(pending).toHaveLength(1)
  })

  test('a failed refresh keeps the last good value, reports the error, and lets the next read retry', () => {
    const { cache, state, errors, pending, run_pending } = build()
    let fail = true
    const compute = ({ reason }: { reason: string }): string => {
      if (reason === 'refresh' && fail)
        throw new Error('recompute blew up')
      return 'good'
    }

    cache.get_or_schedule({ key: 'a', compute })
    state.watermark = 'day-2'
    cache.get_or_schedule({ key: 'a', compute })
    run_pending()

    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe('recompute blew up')
    expect(cache.get_or_schedule({ key: 'a', compute: () => 'unused' })).toBe('good')

    // The single-flight token was released, so the next stale read retries.
    fail = false
    cache.get_or_schedule({ key: 'a', compute })
    expect(pending).toHaveLength(1)
  })

  test('clear() during a scheduled refresh does not repopulate the cache', () => {
    const { cache, state, run_pending } = build()
    let computes = 0
    const compute = (): string => `value-${++computes}`

    cache.get_or_schedule({ key: 'a', compute })
    state.watermark = 'day-2'
    cache.get_or_schedule({ key: 'a', compute })
    cache.clear()
    run_pending()

    // The refresh ran (computes → 2) but its result was discarded, so the next
    // read is a genuine cold miss.
    expect(cache.get_or_schedule({ key: 'a', compute })).toBe('value-3')
  })

  test('clear() from inside a running refresh does not repopulate the cache', () => {
    const { cache, state, run_pending } = build()
    let computes = 0
    const compute = ({ reason }: { reason: string }): string => {
      computes += 1
      if (reason === 'refresh')
        cache.clear()
      return `value-${computes}`
    }

    cache.get_or_schedule({ key: 'a', compute })
    state.watermark = 'day-2'
    cache.get_or_schedule({ key: 'a', compute })
    run_pending()

    expect(cache.size).toBe(0)
  })

  test('keys are independent — one key in flight never blocks another', () => {
    const { cache, state, pending, run_pending } = build()
    const computed: string[] = []
    const compute_for = (key: string) => ({ reason }: { reason: string }): string => {
      computed.push(`${key}:${reason}`)
      return `${key}-${computed.length}`
    }

    cache.get_or_schedule({ key: 'a', compute: compute_for('a') })
    cache.get_or_schedule({ key: 'b', compute: compute_for('b') })
    state.watermark = 'day-2'
    cache.get_or_schedule({ key: 'a', compute: compute_for('a') })
    cache.get_or_schedule({ key: 'b', compute: compute_for('b') })

    expect(pending).toHaveLength(2)

    run_pending()

    expect(computed).toEqual(['a:miss', 'b:miss', 'a:refresh', 'b:refresh'])
    expect(cache.get_or_schedule({ key: 'a', compute: compute_for('a') })).toBe('a-3')
    expect(cache.get_or_schedule({ key: 'b', compute: compute_for('b') })).toBe('b-4')
  })

  test('a null watermark (dev, where no rollup cron runs) is a stable value, not a permanent miss', () => {
    const { cache, state, run_pending } = build({ watermark: null })
    let computes = 0
    const compute = (): string => `value-${++computes}`

    cache.get_or_schedule({ key: 'a', compute })
    expect(cache.get_or_schedule({ key: 'a', compute })).toBe('value-1')

    state.watermark = 'day-1'
    cache.get_or_schedule({ key: 'a', compute })
    run_pending()

    expect(cache.get_or_schedule({ key: 'a', compute })).toBe('value-2')
  })

  test('defaults to next-tick scheduling when no scheduler is injected', async () => {
    const state = { watermark: 'day-1' }
    const cache = new WatermarkSwrCache<number>({
      read_watermark: () => state.watermark,
      on_background_error: () => undefined,
    })
    let computes = 0
    const compute = (): number => ++computes

    cache.get_or_schedule({ key: 'a', compute })
    state.watermark = 'day-2'
    cache.get_or_schedule({ key: 'a', compute })

    expect(computes).toBe(1)
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(computes).toBe(2)
  })

  // ── Async path ───────────────────────────────────────────────────────────

  test('concurrent cold misses adopt ONE compute (async single-flight)', async () => {
    const { cache } = build()
    let computes = 0
    const compute = async (): Promise<string> => {
      computes += 1
      await Promise.resolve()
      return `value-${computes}`
    }

    const [first, second, third] = await Promise.all([
      cache.get_or_schedule_async({ key: 'a', compute }),
      cache.get_or_schedule_async({ key: 'a', compute }),
      cache.get_or_schedule_async({ key: 'a', compute }),
    ])

    expect(computes).toBe(1)
    expect([first, second, third]).toEqual(['value-1', 'value-1', 'value-1'])
  })

  test('a stale async hit returns immediately and refreshes behind the response', async () => {
    const { cache, state, run_pending } = build()
    let computes = 0
    const compute = (): Promise<string> => Promise.resolve(`value-${++computes}`)

    await cache.get_or_schedule_async({ key: 'a', compute })
    state.watermark = 'day-2'
    expect(await cache.get_or_schedule_async({ key: 'a', compute })).toBe('value-1')

    run_pending()
    await cache.settle()

    expect(await cache.get_or_schedule_async({ key: 'a', compute })).toBe('value-2')
  })

  test('allow_stale: false waits for a current value instead of serving a stale one', async () => {
    const { cache, state } = build()
    let computes = 0
    const compute = (): Promise<string> => Promise.resolve(`value-${++computes}`)

    await cache.get_or_schedule_async({ key: 'a', compute })
    state.watermark = 'day-2'

    expect(await cache.get_or_schedule_async({ key: 'a', compute, allow_stale: false })).toBe('value-2')
  })

  test('a failed async refresh reports the error and keeps the last good value', async () => {
    const { cache, state, errors, run_pending } = build()
    const compute = ({ reason }: { reason: string }): Promise<string> =>
      reason === 'refresh'
        ? Promise.reject(new Error('async recompute blew up'))
        : Promise.resolve('good')

    await cache.get_or_schedule_async({ key: 'a', compute })
    state.watermark = 'day-2'
    await cache.get_or_schedule_async({ key: 'a', compute })
    run_pending()
    await cache.settle()
    await Promise.resolve()

    expect(errors.map(error => error.message)).toEqual(['async recompute blew up'])
    expect(await cache.get_or_schedule_async({ key: 'a', compute: () => Promise.resolve('unused') })).toBe('good')
  })

  // `#schedule_async_refresh` used to capture no generation, so `#run_compute`
  // read `this.#generation` at the moment the refresh STARTED RUNNING — a
  // `clear()` landing between "stale read schedules the refresh" and "the
  // refresh runs" was invisible to the guard and the invalidated compute
  // repopulated the cache (and its durable file). The sync twin was always
  // correct, so the two paths disagreed. Found porting into LD, 2026-07-27.
  test('clear() between scheduling an async refresh and running it still blocks the repopulate', async () => {
    const { cache, state, run_pending } = build()
    let computes = 0
    const compute = (): Promise<string> => Promise.resolve(`value-${++computes}`)

    await cache.get_or_schedule_async({ key: 'a', compute })
    state.watermark = 'day-2'
    await cache.get_or_schedule_async({ key: 'a', compute }) // stale → schedules the refresh

    cache.clear()
    run_pending() // the invalidated refresh computes here
    await cache.settle()

    expect(cache.size).toBe(0)
    expect(await cache.get_or_schedule_async({ key: 'a', compute })).toBe('value-3')
  })

  // ── settle() ─────────────────────────────────────────────────────────────

  /**
   * The seam a warm-up job (house's `await_pending_analytics_computes`, LD's
   * `warm_analytics_caches`) and every async test rest on: "the cache is armed"
   * without guessing how many event-loop turns a stage-chunked compute needs.
   * Note what it deliberately does NOT cover — work that is merely SCHEDULED has
   * not started, so a caller that wants a background refresh included must let
   * the scheduler run first (production: `setTimeout`; tests: `run_pending()`).
   */
  test('settle() waits for a compute in flight, including one a scheduled refresh just started', async () => {
    const { cache, state, run_pending } = build()
    const releases: (() => void)[] = []
    let computes = 0
    const compute = (): Promise<string> => {
      const attempt = ++computes
      return new Promise<string>((resolve) => {
        releases.push(() => resolve(`value-${attempt}`))
      })
    }

    const miss = cache.get_or_schedule_async({ key: 'a', compute })
    releases[0]()
    await miss

    state.watermark = 'day-2'
    await cache.get_or_schedule_async({ key: 'a', compute }) // stale hit → schedules a refresh
    run_pending() // the refresh STARTS here, but cannot finish until released

    const order: string[] = []
    const settling = cache.settle().then(() => order.push('settled'))
    await new Promise(resolve => setTimeout(resolve, 0)) // flush every pending microtask
    expect(order).toEqual([]) // still waiting on the refresh

    releases[1]()
    order.push('released')
    await settling
    expect(order).toEqual(['released', 'settled'])
    expect(await cache.get_or_schedule_async({ key: 'a', compute })).toBe('value-2')
  })

  test('settle() resolves when nothing is in flight and never rejects on a failed compute', async () => {
    const { cache, errors } = build()

    await expect(cache.settle()).resolves.toBeUndefined() // idle: resolves, never hangs

    const failing = cache.refresh_async({ key: 'a', compute: () => Promise.reject(new Error('boom')) })
    await expect(cache.settle()).resolves.toBeUndefined()

    // A caller-initiated compute owns its failure — `on_background_error` is for
    // work nobody is awaiting, so a warm-up job that ignores `settle()`'s result
    // still can't lose the error.
    await expect(failing).rejects.toThrow('boom')
    expect(errors).toEqual([])
  })

  // ── Persistence ──────────────────────────────────────────────────────────

  test('a miss serves the persisted value stale-but-instant and refreshes behind it', () => {
    const { store, loads } = memory_store({ a: { watermark: 'day-0', value: 'from-disk' } })
    const { cache, pending, run_pending } = build({ persistence: store })
    let computes = 0

    const value = cache.get_or_schedule({ key: 'a', compute: () => `value-${++computes}` })

    expect(value).toBe('from-disk')
    expect(computes).toBe(0)
    expect(loads).toEqual(['a'])
    expect(pending).toHaveLength(1)

    run_pending()
    expect(computes).toBe(1)
  })

  test('the async miss also serves the persisted value instead of paying a cold recompute', async () => {
    const { store } = memory_store({ a: { watermark: 'day-1', value: 'from-disk' } })
    const { cache } = build({ persistence: store })
    let computes = 0

    const value = await cache.get_or_schedule_async({ key: 'a', compute: () => Promise.resolve(`value-${++computes}`) })

    expect(value).toBe('from-disk')
    expect(computes).toBe(0)
  })

  test('every stored value is mirrored to the durable store', () => {
    const { store, saved, saves } = memory_store()
    const { cache, state, run_pending } = build({ persistence: store })
    let computes = 0
    const compute = (): string => `value-${++computes}`

    cache.get_or_schedule({ key: 'a', compute })
    state.watermark = 'day-2'
    cache.get_or_schedule({ key: 'a', compute })
    run_pending()

    expect(saves).toEqual(['a', 'a'])
    expect(saved.get('a')).toEqual({ watermark: 'day-2', value: 'value-2' })
  })

  test('a persistence failure is reported but never breaks the request', () => {
    const broken: WatermarkSwrPersistence<string> = {
      load: () => { throw new Error('unreadable') },
      save: () => { throw new Error('unwritable') },
    }
    const { cache, errors } = build({ persistence: broken })

    expect(cache.get_or_schedule({ key: 'a', compute: () => 'computed' })).toBe('computed')
    expect(errors.map(error => error.message)).toEqual(['unreadable', 'unwritable'])
  })

  test('clear() drops the in-memory map and a later miss falls back to disk again', () => {
    const { store, loads } = memory_store()
    const { cache } = build({ persistence: store })

    cache.get_or_schedule({ key: 'a', compute: () => 'v' })
    expect(cache.size).toBe(1)
    cache.clear()
    expect(cache.size).toBe(0)
    // A cleared cache falls back to disk exactly like a fresh process would.
    expect(cache.get_or_schedule({ key: 'a', compute: () => 'v2' })).toBe('v')
    expect(loads).toEqual(['a', 'a'])
  })
})
