/// <reference types="svelte" />
export declare function createPersistedStore<T>(key: string, initialValue: T, syncTabs?: boolean): {
  subscribe: (this: void, run: import('svelte/store').Subscriber<T>, invalidate?: import('svelte/store').Invalidator<T>) => import('svelte/store').Unsubscriber
  set: (this: void, value: T) => void
  update: (this: void, updater: import('svelte/store').Updater<T>) => void
}
