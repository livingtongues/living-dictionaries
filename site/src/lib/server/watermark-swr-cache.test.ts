import { describe, expect, test } from 'vitest'
import { WatermarkSwrCache } from './watermark-swr-cache'

/**
 * Deterministic harness: the scheduler queues background work instead of using
 * timers, so a test can hold a refresh "in flight" and decide exactly when it
 * runs (that is the only window in which `clear()` can race a refresh, since
 * the computations themselves are synchronous).
 */
function harness() {
  const pending: (() => void)[] = []
  const errors: Error[] = []
  let watermark: string | null = 'day-1'
  const computed: { key: string, reason: string }[] = []

  const cache = new WatermarkSwrCache<{ label: string, value: number }>({
    read_watermark: () => watermark,
    on_background_error: error => errors.push(error),
    schedule: run => pending.push(run),
  })

  let next_value = 1
  let fail_next_refresh = false

  function get(key: string, project?: (value: { label: string, value: number }) => { label: string, value: number }) {
    return cache.get_or_schedule({
      key,
      compute: ({ reason }) => {
        computed.push({ key, reason })
        if (reason === 'refresh' && fail_next_refresh) {
          fail_next_refresh = false
          throw new Error('compute exploded')
        }
        return { label: `${key}@${watermark}`, value: next_value++ }
      },
      project,
    })
  }

  return {
    cache,
    get,
    computed,
    errors,
    pending,
    run_pending: () => {
      const queued = pending.splice(0, pending.length)
      for (const run of queued) run()
    },
    set_watermark: (value: string | null) => { watermark = value },
    fail_next_refresh: () => { fail_next_refresh = true },
  }
}

describe(WatermarkSwrCache, () => {
  test('cold miss computes in the caller path and caches the result', () => {
    const { get, computed, pending, cache } = harness()

    const first = get('a')

    expect(first).toEqual({ label: 'a@day-1', value: 1 })
    expect(computed).toEqual([{ key: 'a', reason: 'miss' }])
    expect(pending).toHaveLength(0)
    expect(cache.size).toBe(1)
  })

  test('fresh hit returns the cached value without recomputing or scheduling', () => {
    const { get, computed, pending } = harness()
    get('a')

    const second = get('a')

    expect(second).toEqual({ label: 'a@day-1', value: 1 })
    expect(computed).toHaveLength(1)
    expect(pending).toHaveLength(0)
  })

  test('stale hit returns the old value immediately and refreshes in the background', () => {
    const { get, computed, pending, run_pending, set_watermark } = harness()
    get('a')
    set_watermark('day-2')

    const stale = get('a')

    expect(stale).toEqual({ label: 'a@day-1', value: 1 })
    expect(computed).toHaveLength(1)
    expect(pending).toHaveLength(1)

    run_pending()

    expect(computed).toEqual([{ key: 'a', reason: 'miss' }, { key: 'a', reason: 'refresh' }])
    expect(get('a')).toEqual({ label: 'a@day-2', value: 2 })
    // Refreshed AT the new watermark, so the next read is a fresh hit.
    expect(pending).toHaveLength(0)
  })

  test('a projector decorates cached hits only, never the fresh compute or the stored value', () => {
    const { get, set_watermark, run_pending } = harness()
    const project = (value: { label: string, value: number }) => ({ ...value, label: `${value.label}+live` })

    expect(get('a', project)).toEqual({ label: 'a@day-1', value: 1 })
    expect(get('a', project)).toEqual({ label: 'a@day-1+live', value: 1 })

    set_watermark('day-2')
    get('a', project)
    run_pending()

    // The refresh stored the raw computed value, not a projected one.
    expect(get('a')).toEqual({ label: 'a@day-2', value: 2 })
  })

  test('concurrent stale reads schedule exactly one refresh (single-flight per key)', () => {
    const { get, pending, computed, run_pending, set_watermark } = harness()
    get('a')
    set_watermark('day-2')

    get('a')
    get('a')
    get('a')

    expect(pending).toHaveLength(1)

    run_pending()

    expect(computed.filter(({ reason }) => reason === 'refresh')).toHaveLength(1)
  })

  test('a failed refresh keeps the last good value, reports the error, and can retry', () => {
    const { get, errors, run_pending, set_watermark, fail_next_refresh, pending } = harness()
    get('a')
    set_watermark('day-2')
    fail_next_refresh()

    get('a')
    run_pending()

    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe('compute exploded')
    expect(get('a')).toEqual({ label: 'a@day-1', value: 1 })
    // The single-flight token was released, so the next stale read retries.
    expect(pending).toHaveLength(1)

    run_pending()

    // The throw happened before a value was minted, so the retry takes the next one.
    expect(get('a')).toEqual({ label: 'a@day-2', value: 2 })
  })

  test('clear during an in-flight refresh does not repopulate the cache', () => {
    const { cache, get, computed, run_pending, set_watermark } = harness()
    get('a')
    set_watermark('day-2')
    get('a')

    cache.clear()
    run_pending() // the invalidated refresh completes here

    expect(cache.size).toBe(0)
    expect(get('a')).toEqual({ label: 'a@day-2', value: 3 })
    expect(computed.map(({ reason }) => reason)).toEqual(['miss', 'refresh', 'miss'])
  })

  test('clear lets a new refresh start for a key whose old refresh is still in flight', () => {
    const { cache, get, pending, run_pending, set_watermark } = harness()
    get('a')
    set_watermark('day-2')
    get('a')

    cache.clear()
    get('a') // cold again
    set_watermark('day-3')
    get('a')

    expect(pending).toHaveLength(2)

    run_pending()

    expect(get('a')).toEqual({ label: 'a@day-3', value: 4 })
  })

  test('keys are independent — one key in flight never blocks another', () => {
    const { get, pending, computed, run_pending, set_watermark } = harness()
    get('a')
    get('b')
    set_watermark('day-2')

    get('a')
    get('b')

    expect(pending).toHaveLength(2)

    run_pending()

    expect(computed.filter(({ key, reason }) => key === 'a' && reason === 'refresh')).toHaveLength(1)
    expect(computed.filter(({ key, reason }) => key === 'b' && reason === 'refresh')).toHaveLength(1)
    expect(get('a').label).toBe('a@day-2')
    expect(get('b').label).toBe('b@day-2')
  })

  test('a null watermark (dev, where no rollup cron runs) is a stable value, not a permanent miss', () => {
    const { get, pending, set_watermark, computed } = harness()
    set_watermark(null)

    get('a')
    get('a')

    expect(computed).toHaveLength(1)
    expect(pending).toHaveLength(0)

    set_watermark('day-1')
    get('a')

    expect(pending).toHaveLength(1)
  })

  test('defaults to next-tick scheduling when no scheduler is injected', async () => {
    let watermark = 'day-1'
    const background_errors: Error[] = []
    const cache = new WatermarkSwrCache<number>({
      read_watermark: () => watermark,
      on_background_error: error => background_errors.push(error),
    })
    let computes = 0
    const get = () => cache.get_or_schedule({ key: 'a', compute: () => ++computes })

    expect(get()).toBe(1)
    watermark = 'day-2'
    expect(get()).toBe(1)
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(get()).toBe(2)
    expect(background_errors).toHaveLength(0)
  })
})
