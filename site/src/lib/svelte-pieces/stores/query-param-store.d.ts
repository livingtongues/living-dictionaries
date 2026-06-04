/// <reference types="svelte" />
import type { Writable } from 'svelte/store'

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
export declare function createQueryParamStore<T>(options: QueryParamStoreOptions<T>): {
  subscribe: (this: void, run: import('svelte/store').Subscriber<T>, invalidate?: import('svelte/store').Invalidator<T>) => import('svelte/store').Unsubscriber
  set: (value: any) => void
  update: (fn: (value: T) => T) => void
  remove: () => void
}
