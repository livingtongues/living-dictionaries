/**
 * Simple event emitter for table change notifications.
 * After any write to a table, call notify(table_name) to trigger re-queries
 * in all subscribed TableStores.
 */
export class TableChangeNotifier {
  #listeners = new Map<string, Set<() => void>>()

  notify(table_name: string) {
    const listeners = this.#listeners.get(table_name)
    if (listeners) {
      for (const listener of listeners) {
        listener()
      }
    }
  }

  subscribe(table_name: string, callback: () => void): () => void {
    if (!this.#listeners.has(table_name)) {
      this.#listeners.set(table_name, new Set())
    }
    this.#listeners.get(table_name)!.add(callback)

    return () => {
      const listeners = this.#listeners.get(table_name)
      if (listeners) {
        listeners.delete(callback)
        if (listeners.size === 0) {
          this.#listeners.delete(table_name)
        }
      }
    }
  }
}
