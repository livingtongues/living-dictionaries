import { writable } from 'svelte/store'

export function createPersistedStore<T>(key: string, initialValue: T, syncTabs = false) {
  if (typeof window === 'undefined') {
    const { subscribe, set, update } = writable<T>(initialValue)
    return { subscribe, set, update }
  }

  const { subscribe, set, update } = writable<T>(initialValue, start)

  function getCached() {
    const cachedValue = localStorage.getItem(key)
    if (cachedValue && cachedValue !== 'undefined')
      set(JSON.parse(cachedValue))
  }

  function start() {
    getCached()

    if (syncTabs) {
      window.addEventListener('storage', getCached)

      return () => {
        window.removeEventListener('storage', getCached)
      }
    }
  }

  const setStoreValue = (updatedValue: T) => {
    set(updatedValue)
    localStorage.setItem(key, JSON.stringify(updatedValue))
  }

  const updateStoreValue = (callback: (value: T) => T) => {
    update((currentValue) => {
      const updatedValue = callback(currentValue)
      localStorage.setItem(key, JSON.stringify(updatedValue))
      return updatedValue
    })
  }

  return { subscribe, set: setStoreValue, update: updateStoreValue }
}
