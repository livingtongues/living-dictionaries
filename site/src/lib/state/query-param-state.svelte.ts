import { clean_object } from '$lib/utils/clean-object'
import { deep_equal } from '$lib/utils/deep-equal'
import { log_warning } from '$lib/debug/remote-log'
import { goto } from '$app/navigation'
import { page } from '$app/state'

export interface QueryParamStateOptions<T> {
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
  const cleaned_value = clean_object(value, cleanFalseValues)
  return cleaned_value === undefined ? undefined : JSON.stringify(cleaned_value)
}

export function parse(value: any) {
  if (typeof value === 'undefined')
    return undefined
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

export class QueryParamState<T> {
  #value = $state<T>() as T
  #key: string
  #log?: boolean
  #persist?: 'localStorage' | 'sessionStorage'
  #clean_false_values?: boolean
  #replace_state: boolean
  #start_with?: T
  #storage_key: string
  #storage?: Storage
  #first_url_check = true
  #current_params_value: string | null | undefined
  #state_value: T | undefined
  #applying_url_value = false
  #dispose?: () => void

  constructor(options: QueryParamStateOptions<T>) {
    const { key, log, persist, startWith, cleanFalseValues } = options
    this.#key = key
    this.#log = log
    this.#persist = persist
    this.#start_with = startWith
    this.#clean_false_values = cleanFalseValues
    this.#replace_state = typeof options.replaceState === 'undefined' ? true : options.replaceState
    this.#storage_key = `${options.storagePrefix || ''}${key}`
    this.#value = startWith as T
    this.#state_value = structuredClone(startWith)

    if (typeof window === 'undefined')
      return
    if (persist === 'localStorage')
      this.#storage = localStorage
    if (persist === 'sessionStorage')
      this.#storage = sessionStorage

    this.#handle_search_params(page.url.searchParams)
    this.#dispose = $effect.root(() => {
      $effect(() => {
        this.#handle_search_params(page.url.searchParams)
      })
      $effect(() => {
        const value = $state.snapshot(this.#value) as T
        if (!this.#applying_url_value && !deep_equal(value, this.#state_value))
          this.#set_query_param(value)
      })
    })
  }

  get value(): T {
    return this.#value
  }

  set value(value: T) {
    this.#set_query_param(value)
  }

  update(fn: (value: T) => T) {
    this.#set_query_param(fn($state.snapshot(this.#value) as T))
  }

  remove() {
    if (typeof window === 'undefined')
      return
    const { hash } = window.location
    const search_params = new URLSearchParams(window.location.search)
    if (!search_params.has(this.#key))
      return
    search_params.delete(this.#key)
    goto(`?${search_params}${hash}`, { keepFocus: true, noScroll: true, replaceState: this.#replace_state })
    if (this.#log)
      console.info(`user action removed: ${this.#key}`)
  }

  destroy() {
    this.#dispose?.()
    this.#dispose = undefined
  }

  #set_query_param(value: T) {
    if (typeof window === 'undefined')
      return
    const stringified_value = stringify(value, this.#clean_false_values)
    if (stringified_value === undefined)
      return this.remove()
    const { hash } = window.location
    const search_params = new URLSearchParams(window.location.search)
    const current_raw = search_params.get(this.#key)
    // Compare parsed values so object keys reordered by a consumer do not cause a navigation echo.
    if (current_raw !== null && deep_equal(parse(current_raw), parse(stringified_value)))
      return
    search_params.set(this.#key, stringified_value)
    goto(`?${search_params}${hash}`, { keepFocus: true, noScroll: true, replaceState: this.#replace_state })
    if (this.#log)
      console.info(`user action changed: ${this.#key} to ${value}`)
  }

  #set_state_value(value: string | null) {
    if (this.#log)
      console.info(`URL set ${this.#key} to ${value}`)
    let parsed_value = parse(value)
    if (typeof this.#start_with === 'object' && (typeof parsed_value !== 'object' || parsed_value === null)) {
      if (typeof window !== 'undefined' && value !== '' && value !== null && value !== undefined)
        log_warning({ message: 'malformed_query_param', context: { key: this.#key, raw: String(value).slice(0, 120) } })
      parsed_value = {}
    }
    this.#storage?.setItem(this.#storage_key, JSON.stringify(parsed_value))
    // Keep an independent baseline: nested bindings mutate the state proxy before this URL echo.
    if (deep_equal(parsed_value, this.#state_value)) {
      if (this.#log)
        console.info('parsed value equals current state value, skipping update')
      return
    }
    this.#state_value = structuredClone(parsed_value)
    this.#applying_url_value = true
    try {
      this.#value = parsed_value
    } finally {
      this.#applying_url_value = false
    }
    if (this.#log && this.#storage)
      console.info({ [`${this.#storage_key}_to_cache`]: parsed_value })
  }

  #handle_search_params(search_params: URLSearchParams) {
    // A synchronous navigation echo must not re-enter while a URL value is being applied.
    if (this.#applying_url_value)
      return
    let value = search_params.get(this.#key)
    if (this.#current_params_value !== undefined && value === this.#current_params_value) {
      if (this.#log)
        console.info('query params are same value, skipping update')
      return
    }
    this.#current_params_value = value
    if (!this.#first_url_check)
      return this.#set_state_value(value)
    this.#first_url_check = false
    if (value !== null && value !== '')
      return this.#set_state_value(value)
    if (typeof window === 'undefined')
      return
    if (this.#persist) {
      value = JSON.parse(this.#storage?.getItem(this.#storage_key) ?? 'null')
      if (this.#log)
        console.info({ [`${this.#storage_key}_from_cache`]: value })
    }
    if (value)
      this.#set_query_param(value as T)
  }
}
// SvelteKit Goto discussion https://github.com/sveltejs/kit/issues/969
