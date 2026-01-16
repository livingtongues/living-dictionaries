import { goto } from '$app/navigation'
import { page } from '$app/stores'
import { writable, type Readable } from 'svelte/store'
import { clean_object } from './clean-object'

export interface QueryParamStoreOptions<T> {
  key: string
  startWith?: T
  /** True by default */
  replaceState?: boolean
  persist?: 'localStorage' | 'sessionStorage'
  storagePrefix?: string
  cleanFalseValues?: boolean
  log?: boolean
}

export interface QueryParamStore<T> extends Readable<T> {
  set: (value: T) => void
  update: (fn: (value: T) => T) => void
  remove: () => void
}

export function create_query_params_store<T>(options: QueryParamStoreOptions<T>): QueryParamStore<T> {
  const { key, log, persist, startWith, cleanFalseValues } = options
  const replaceState = typeof options.replaceState === 'undefined' ? true : options.replaceState
  const storageKey = `${options.storagePrefix || ''}${key}`

  let storage: Storage
  if (typeof window !== 'undefined') {
    if (persist === 'localStorage')
      storage = localStorage
    if (persist === 'sessionStorage')
      storage = sessionStorage
  }

  const removeQueryParam = () => {
    const { hash } = window.location
    const searchParams = new URLSearchParams(window.location.search)
    searchParams.delete(key)
    goto(`?${searchParams}${hash}`, { keepFocus: true, noScroll: true, replaceState })
    if (log)
      console.info(`user action removed: ${key}`)
  }

  const setQueryParam = (value) => {
    if (typeof window === 'undefined')
      return // safety check in case store value is assigned via $: call server side
    const stringified_value = stringify(value, cleanFalseValues)
    if (stringified_value === undefined)
      return removeQueryParam()
    const { hash } = window.location
    const searchParams = new URLSearchParams(window.location.search)
    searchParams.set(key, stringify(value, cleanFalseValues))
    goto(`?${searchParams}${hash}`, { keepFocus: true, noScroll: true, replaceState })
    if (log)
      console.info(`user action changed: ${key} to ${value}`)
  }

  const updateQueryParam = (fn: (value: T) => T) => {
    const searchParams = new URLSearchParams(window.location.search)
    const value = searchParams.get(key)
    const parsed_value = parse(value) as T
    setQueryParam(fn(parsed_value))
  }

  const setStoreValue = (value: string) => {
    if (log)
      console.info(`URL set ${key} to ${value}`)
    let parsed_value = parse(value) as T
    if (!parsed_value && typeof startWith === 'object')
      parsed_value = {} as T
    // eslint-disable-next-line ts/no-use-before-define
    set(parsed_value)
    storage?.setItem(storageKey, JSON.stringify(parsed_value))
    if (log && storage)
      console.info({ [`${storageKey}_to_cache`]: parsed_value })
  }

  let firstUrlCheck = true
  let current_params_value: string

  const start = () => {
    const unsubscribe_from_page_store = page.subscribe(({ url: { searchParams } }) => {
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
        const storage_value = JSON.parse(storage.getItem(storageKey))
        const is_empty_object = typeof storage_value === 'object' && Object.keys(storage_value || {}).length === 0
        if (storage_value !== undefined && storage_value !== null && storage_value !== '' && !is_empty_object) {
          value = storage_value
          if (log)
            console.info({ [`${storageKey}_from_cache`]: value })
        }
      }

      if (value)
        return setQueryParam(value)
    })

    return () => unsubscribe_from_page_store()
  }

  // 3rd Priority: use startWith if no query param in url nor storage value found
  const store = writable<T>(startWith, start)
  const { subscribe, set } = store

  return {
    subscribe,
    set: setQueryParam,
    update: updateQueryParam,
    remove: removeQueryParam,
  }
}

// SvelteKit Goto dicussion https://github.com/sveltejs/kit/issues/969

function stringify(value, cleanFalseValues: boolean): string | undefined {
  if (typeof value === 'undefined' || value === null || value === '')
    return undefined
  if (typeof value === 'string')
    return value

  const cleanedValue = clean_object(value, cleanFalseValues)
  return cleanedValue === undefined ? undefined : JSON.stringify(cleanedValue)
}

function parse(value: string) {
  if (typeof value === 'undefined')
    return undefined
  try {
    return JSON.parse(value)
  } catch {
    return value // if the original input was just a string (and never JSON stringified), it will throw an error so just return the string
  }
}
