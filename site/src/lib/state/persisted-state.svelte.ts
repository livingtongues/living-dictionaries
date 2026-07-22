import { browser } from '$app/environment'

export class PersistedState<T> {
  value = $state<T>() as T
  #destroy: () => void

  constructor(private key: string, initial_value: T, { sync_tabs }: { sync_tabs?: boolean } = {}) {
    this.value = initial_value

    if (browser)
      this.#get_cached()

    if (!browser) {
      this.#destroy = () => undefined
      return
    }

    const storage_handler = () => this.#get_cached()
    this.#destroy = $effect.root(() => {
      $effect(() => {
        localStorage.setItem(this.key, this.#serialize(this.value))
      })
      if (sync_tabs)
        window.addEventListener('storage', storage_handler)
      return () => {
        if (sync_tabs)
          window.removeEventListener('storage', storage_handler)
      }
    })
  }

  destroy(): void {
    this.#destroy()
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
