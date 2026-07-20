import { flushSync } from 'svelte'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { QueryParamState } from './query-param-state.svelte'
import { goto, navigation_log, reset_navigation } from '$lib/mocks/app-navigation'

interface Params {
  page?: number
  query?: string
  tags?: string[]
  has_sentence?: boolean
}

function make_state(options: { persist?: 'localStorage' | 'sessionStorage' } = {}) {
  const state = new QueryParamState<Params>({
    key: 'q',
    startWith: { page: 1, query: '' },
    cleanFalseValues: true,
    ...options,
  })
  states.push(state)
  return state
}

let states: QueryParamState<Params>[] = []

beforeEach(() => {
  reset_navigation('http://localhost:3000/dictionary/entries')
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  states.forEach(state => state.destroy())
  states = []
  vi.restoreAllMocks()
})

describe(QueryParamState, () => {
  test('a new value navigates once and flows back from the URL', () => {
    const state = make_state()

    state.value = { page: 1, query: 'anno' }
    flushSync()

    expect(navigation_log).toHaveLength(1)
    expect(new URL(navigation_log[0].url, 'http://localhost:3000').searchParams.get('q'))
      .toBe('{"page":1,"query":"anno"}')
    expect(state.value).toEqual({ page: 1, query: 'anno' })
  })

  test('an identical value with reordered keys does not re-navigate', () => {
    const state = make_state()

    state.value = { page: 1, query: 'anno' }
    flushSync()
    state.value = { query: 'anno', page: 1 }
    flushSync()

    expect(navigation_log).toHaveLength(1)
  })

  test('a key-reordered URL echo does not replace the current state proxy', () => {
    const state = make_state()
    state.value = { page: 1, query: 'anno' }
    flushSync()
    const current_value = state.value

    const search_params = new URLSearchParams()
    search_params.set('q', JSON.stringify({ query: 'anno', page: 1 }))
    goto(`?${search_params}`)
    flushSync()

    expect(state.value).toBe(current_value)
    expect(state.value).toEqual({ page: 1, query: 'anno' })
  })

  test('an in-place nested mutation navigates once and remains reactive', () => {
    const state = make_state()

    state.value.query = 'anno'
    flushSync()

    expect(navigation_log).toHaveLength(1)
    expect(state.value).toEqual({ page: 1, query: 'anno' })

    state.value.page = 2
    flushSync()
    expect(navigation_log).toHaveLength(2)
    expect(state.value).toEqual({ page: 2, query: 'anno' })
  })

  test('update starts from the reactive value when the URL parameter is absent', () => {
    const state = make_state()

    state.update(value => ({ ...value, tags: ['visible'] }))
    flushSync()

    expect(navigation_log).toHaveLength(1)
    expect(state.value).toEqual({ page: 1, tags: ['visible'] })
  })

  test('reflects external navigation and reaches a steady state', () => {
    const state = make_state()
    const search_params = new URLSearchParams()
    search_params.set('q', JSON.stringify({ page: 2, query: 'blue', tags: ['teglunaliq'] }))

    goto(`?${search_params}`)
    flushSync()
    const settled_navigations = navigation_log.length
    flushSync()
    flushSync()

    expect(navigation_log).toHaveLength(settled_navigations)
    expect(state.value).toEqual({ page: 2, query: 'blue', tags: ['teglunaliq'] })
  })

  test('coerces a malformed scalar query value to an empty object', () => {
    const state = make_state()

    goto('?q=hua')
    flushSync()

    expect(state.value).toEqual({})
  })

  test('remove clears the parameter without a re-entrant echo', () => {
    reset_navigation('http://localhost:3000/dictionary/entries?q=%7B%22query%22%3A%22anno%22%7D&other=kept')
    const state = make_state()

    state.remove()
    flushSync()

    expect(navigation_log).toHaveLength(1)
    const url = new URL(navigation_log[0].url, 'http://localhost:3000')
    expect(url.searchParams.has('q')).toBeFalsy()
    expect(url.searchParams.get('other')).toBe('kept')
    expect(state.value).toEqual({})
  })

  test('restores persisted state through the URL', () => {
    localStorage.setItem('q', JSON.stringify({ page: 3, query: 'cached' }))

    const state = make_state({ persist: 'localStorage' })
    flushSync()

    expect(navigation_log).toHaveLength(1)
    expect(state.value).toEqual({ page: 3, query: 'cached' })
    expect(new URL(window.location.href).searchParams.get('q')).toBe('{"page":3,"query":"cached"}')
  })
})
