import { browser } from '$app/environment'
import { onDestroy } from 'svelte'

export class PersistedState<T> {
  value = $state<T>() as T

  constructor(private key: string, initial_value: T, { sync_tabs }: { sync_tabs?: boolean } = {}) {
    this.value = initial_value

    if (browser)
      this.#get_cached()

    $effect(() => {
      localStorage.setItem(this.key, this.#serialize(this.value))
    })

    if (sync_tabs && browser) {
      window.addEventListener('storage', () => this.#get_cached())
    }

    onDestroy(() => {
      if (sync_tabs && browser) {
        window.removeEventListener('storage', () => this.#get_cached())
      }
    })
  }

  #get_cached() {
    const item = localStorage.getItem(this.key)
    if (item && item !== 'undefined')
      this.value = this.#deserialize(item)
  }

  #serialize(value: T): string {
    return JSON.stringify(value)
  }

  #deserialize(item: string): T {
    return JSON.parse(item)
  }
}
