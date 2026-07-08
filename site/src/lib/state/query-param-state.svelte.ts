import { writable } from 'svelte/store'
import type { Writable } from 'svelte/store'
import { cleanObject } from '$lib/utils/clean-object'
import { deep_equal } from '$lib/utils/deep-equal'
import { log_warning } from '$lib/debug/remote-log'
import { goto } from '$app/navigation'
import { page } from '$app/state'

export interface QueryParamStore<T> extends Writable<T> {
  remove: () => void
}
export interface QueryParamStoreOptions<T> {
  key: string
  startWith?: T
  replaceState?: boolean
  persist?: 'localStorage' | 'sessionStorage'
  storagePrefix?: string
  cleanFalseValues?: boolean
  log?: boolean
}

export function stringify(value: any, cleanFalseValues?: boolean) {
  if (typeof value === 'undefined' || value === null || value === '')
    return undefined
  if (typeof value === 'string')
    return value
  const cleanedValue = cleanObject(value, cleanFalseValues)
  return cleanedValue === undefined ? undefined : JSON.stringify(cleanedValue)
}
export function parse(value: any) {
  if (typeof value === 'undefined')
    return undefined
  try {
    return JSON.parse(value)
  } catch {
    return value // if the original input was just a string (and never JSON stringified), it will throw an error so just return the string
  }
}
export function createQueryParamStore<T>(options: QueryParamStoreOptions<T>) {
  const { key, log, persist, startWith, cleanFalseValues } = options
  const replaceState = typeof options.replaceState === 'undefined' ? true : options.replaceState
  const storageKey = `${options.storagePrefix || ''}${key}`
  let storage: Storage | undefined
  if (typeof window !== 'undefined') {
    if (persist === 'localStorage')
      storage = localStorage
    if (persist === 'sessionStorage')
      storage = sessionStorage
  }
  const setQueryParam = (value: any) => {
    if (typeof window === 'undefined')
      return // safety check in case store value is assigned via $: call server side
    const stringified_value = stringify(value, cleanFalseValues)
    if (stringified_value === undefined)
      return removeQueryParam()
    const { hash } = window.location
    const searchParams = new URLSearchParams(window.location.search)
    // No-op navigation guard: a subscriber writing back the value it just received
    // (two-way binds, effects re-deriving the same params) must not fire a redundant
    // `goto`, which re-runs the URL effect → `set()` → the subscriber again. Compared
    // DEEPLY (not by raw string) so a re-ordered-key echo — `{query,page}` vs the URL's
    // `{page,query}` — is also recognised as identical. Breaks the store↔URL loop.
    const current_raw = searchParams.get(key)
    if (current_raw !== null && deep_equal(parse(current_raw), parse(stringified_value)))
      return
    searchParams.set(key, stringified_value)
    goto(`?${searchParams}${hash}`, { keepFocus: true, noScroll: true, replaceState })
    if (log)
      console.info(`user action changed: ${key} to ${value}`)
  }
  const updateQueryParam = (fn: (value: any) => any) => {
    const searchParams = new URLSearchParams(window.location.search)
    const value = searchParams.get(key)
    const parsed_value = parse(value)
    setQueryParam(fn(parsed_value))
  }
  const removeQueryParam = () => {
    const { hash } = window.location
    const searchParams = new URLSearchParams(window.location.search)
    searchParams.delete(key)
    goto(`?${searchParams}${hash}`, { keepFocus: true, noScroll: true, replaceState })
    if (log)
      console.info(`user action removed: ${key}`)
  }
  // The last value pushed into the writable — tracked here (not read back via
  // `get(store)`, which would spin a throwaway subscription and re-run `start`) so
  // `setStoreValue` can deep-equal-dedupe redundant emits.
  let store_value: T | undefined = startWith
  // Re-entrancy guard: if a `goto` resolves synchronously (shallow/`pushState`
  // navigations can), the URL effect could re-enter `handle_search_params` mid-emit.
  let applying_store_value = false
  const setStoreValue = (value: any) => {
    if (log)
      console.info(`URL set ${key} to ${value}`)
    let parsed_value = parse(value)
    // An object-shaped store (e.g. the entries page's `?q={"query":…}`) must never
    // hold a scalar: a hand-typed/legacy `?q=hua` parses to the bare string `'hua'`,
    // and a later `bind:checked={$store.has_sentence}` then throws "Cannot create
    // property 'has_sentence' on string 'hua'". The old guard only caught FALSY values;
    // coerce ANY non-object back to the empty default (was a live crash — 2026-07-07 log review).
    if (typeof startWith === 'object' && (typeof parsed_value !== 'object' || parsed_value === null)) {
      if (typeof window !== 'undefined' && value !== '' && value !== null && value !== undefined)
        log_warning({ message: 'malformed_query_param', context: { key, raw: String(value).slice(0, 120) } })
      parsed_value = {}
    }
    storage?.setItem(storageKey, JSON.stringify(parsed_value))
    // Deep-equal dedupe: a URL echo that parses to a value we already hold must NOT
    // push a fresh object identity into subscribers. A redundant emit re-triggers
    // downstream `$derived`/`bind:` reactions that write the same value back through
    // `goto`, re-running this effect — the entry-page `effect_update_depth_exceeded`
    // loop introduced when the store moved to `$app/state` + `$effect.root` (af2ec863).
    if (deep_equal(parsed_value, store_value)) {
      if (log)
        console.info('parsed value equals current store value, skipping emit')
      return
    }
    store_value = parsed_value
    applying_store_value = true
    try {
      set(parsed_value)
    } finally {
      applying_store_value = false
    }
    if (log && storage)
      console.info({ [`${storageKey}_to_cache`]: parsed_value })
  }
  let firstUrlCheck = true
  let current_params_value: string | null
  const handle_search_params = (searchParams: URLSearchParams) => {
    if (applying_store_value)
      return // re-entrancy guard: ignore a URL echo triggered by our own in-flight `set()`
    let value = searchParams.get(key)
    if (current_params_value && value === current_params_value) {
      if (log)
        console.info('query params are same value, skipping set')
      return // don't emit store change if page navigation happened with same query params
    }
    current_params_value = value
    // Set store value from url - skipped on first load
    if (!firstUrlCheck)
      return setStoreValue(value)
    firstUrlCheck = false
    // 1st Priority: check url query param for value
    if (value !== undefined && value !== null && value !== '')
      return setStoreValue(value)
    if (typeof window === 'undefined')
      return
    // 2nd Priority: check localStorage/sessionStorage for value
    if (persist) {
      value = JSON.parse(storage.getItem(storageKey))
      if (log)
        console.info({ [`${storageKey}_from_cache`]: value })
    }
    if (value)
      return setQueryParam(value)
  }
  const start = () => {
    // Replaces the old deprecated `$app/stores` `page.subscribe(...)`. `$app/state`'s `page`
    // is rune-reactive but has no `.subscribe`, so we read it inside an `$effect.root` —
    // the rune that "allows for the creation of effects outside of the component
    // initialisation phase" — to track URL changes from this store factory. The synchronous
    // first read preserves the old sync-on-subscribe behaviour (correct value on initial
    // render); the effect's own initial run dedupes against `current_params_value`.
    handle_search_params(page.url.searchParams)
    return $effect.root(() => {
      $effect(() => {
        handle_search_params(page.url.searchParams)
      })
    })
  }
  // 3rd Priority: use startWith if no query param in url nor storage value found
  const store = writable(startWith, start)
  const { subscribe, set } = store
  return {
    subscribe,
    set: setQueryParam,
    update: updateQueryParam,
    remove: removeQueryParam,
  }
}
// SvelteKit Goto dicussion https://github.com/sveltejs/kit/issues/969
