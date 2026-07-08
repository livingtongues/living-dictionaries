import { flushSync } from 'svelte'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { createQueryParamStore } from './query-param-state.svelte'
// Import the mock helpers from the real path (vitest aliases `$app/navigation` to
// this same file, so the store and the test share one `navigation_log`/`goto`).
import { goto, navigation_log, reset_navigation } from '$lib/mocks/app-navigation'

// These tests drive the REAL store through real Svelte reactivity: the mock
// `goto` ($app/navigation) updates the happy-dom URL + the `$app/state` `page.url`
// `$state`, which the store's internal `$effect` tracks. So a store↔URL feedback
// loop would actually manifest here (runaway `goto`s / `effect_update_depth_exceeded`),
// which is the regression these guards prevent.

interface Params {
  page?: number
  query?: string
  tags?: string[]
  has_sentence?: boolean
}

function make_store() {
  return createQueryParamStore<Params>({
    key: 'q',
    startWith: { page: 1, query: '' },
    cleanFalseValues: true,
  })
}

function last<T>(items: T[]): T {
  return items[items.length - 1]
}

let unsubscribers: (() => void)[] = []

function subscribe(store: ReturnType<typeof make_store>, on_value: (value: Params) => void) {
  const unsub = store.subscribe(on_value)
  unsubscribers.push(unsub)
  flushSync()
}

beforeEach(() => {
  reset_navigation('http://localhost:3000/dictionary/entries')
})

afterEach(() => {
  unsubscribers.forEach(unsub => unsub())
  unsubscribers = []
})

describe(createQueryParamStore, () => {
  test('a new value navigates once and emits it back through the URL', () => {
    const store = make_store()
    const emissions: Params[] = []
    subscribe(store, value => emissions.push(value))

    store.set({ page: 1, query: 'anno' })
    flushSync()

    expect(navigation_log).toHaveLength(1)
    expect(new URL(navigation_log[0].url, 'http://localhost:3000').searchParams.get('q'))
      .toBe('{"page":1,"query":"anno"}')
    expect(last(emissions)).toEqual({ page: 1, query: 'anno' })
  })

  test('writing back an identical value does not re-navigate (no-op nav guard)', () => {
    const store = make_store()
    subscribe(store, () => { /* observe only */ })

    store.set({ page: 1, query: 'anno' })
    flushSync()
    expect(navigation_log).toHaveLength(1)

    // A subscriber re-deriving and writing back the same value (fresh identity)
    // must not fire a second navigation.
    store.set({ query: 'anno', page: 1 })
    flushSync()
    expect(navigation_log).toHaveLength(1)
  })

  test('a key-reordered URL echo does not re-emit (deep-equal dedupe)', () => {
    const store = make_store()
    const emissions: Params[] = []
    subscribe(store, value => emissions.push(value))

    store.set({ page: 1, query: 'anno' })
    flushSync()
    const emissions_after_set = emissions.length

    // Simulate an external navigation to the SAME logical value but a different
    // JSON string (keys reordered). Without the deep-equal dedupe this pushes a
    // fresh object identity to subscribers — the churn that fed the entry-page loop.
    const sp = new URLSearchParams()
    sp.set('q', JSON.stringify({ query: 'anno', page: 1 }))
    goto(`?${sp}`)
    flushSync()

    expect(emissions).toHaveLength(emissions_after_set)
    expect(last(emissions)).toEqual({ page: 1, query: 'anno' })
  })

  test('a subscriber that writes back on every emission reaches a steady state', () => {
    const store = make_store()
    const emissions: Params[] = []
    // Model a two-way-bound consumer: echoes back a fresh-identity copy of every
    // value it receives. Without the dedupe + no-op-nav + re-entrancy guards this
    // ping-pongs store→URL→store forever (`effect_update_depth_exceeded`).
    subscribe(store, (value) => {
      emissions.push(value)
      store.set({ ...value })
    })

    store.set({ page: 1, query: 'anno' })
    flushSync()

    const settled_navigations = navigation_log.length
    const settled_emissions = emissions.length
    // Further flushes must not keep growing — the system is at rest.
    flushSync()
    flushSync()

    expect(navigation_log).toHaveLength(settled_navigations)
    expect(emissions).toHaveLength(settled_emissions)
    expect(last(emissions)).toEqual({ page: 1, query: 'anno' })
  })

  test('reflects an external navigation to a genuinely new value', () => {
    const store = make_store()
    const emissions: Params[] = []
    subscribe(store, value => emissions.push(value))

    const sp = new URLSearchParams()
    sp.set('q', JSON.stringify({ page: 2, query: 'blue', tags: ['teglunaliq'] }))
    goto(`?${sp}`)
    flushSync()

    expect(last(emissions)).toEqual({ page: 2, query: 'blue', tags: ['teglunaliq'] })
  })

  test('coerces a malformed scalar ?q= to the empty object default', () => {
    const store = make_store()
    const emissions: Params[] = []
    subscribe(store, value => emissions.push(value))

    // A hand-typed/legacy `?q=hua` parses to the bare string 'hua'; an object store
    // must never hold a scalar (would crash `bind:checked={$store.has_sentence}`).
    goto('?q=hua')
    flushSync()

    expect(last(emissions)).toEqual({})
  })
})
