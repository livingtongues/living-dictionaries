/**
 * Defer a synchronous computation (typically a blocking better-sqlite3 query) so
 * a SvelteKit server `load` can RETURN immediately with a still-pending promise.
 * SvelteKit then flushes the page shell right away — navigation transitions to a
 * skeleton instantly — and streams this value in when it resolves.
 *
 * Why the `setImmediate` yield matters: better-sqlite3 is synchronous, so
 * `(async () => query())()` runs the whole query BEFORE the promise returns to
 * `load`, blocking the transition. Yielding one macrotask lets the shell bytes
 * hit the socket first; the query then runs and the row streams behind it.
 *
 * Usage:
 *   return { analytics: stream(() => get_usage_analytics({ shared_db, days })) }
 * and consume with `{#await data.analytics}` + a skeleton in the page.
 *
 * A thrown error becomes a rejected promise SvelteKit serializes to the page's
 * `{:catch}` branch (no unhandled rejection).
 */
export function stream<T>(compute: () => T | Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    setImmediate(() => {
      try {
        resolve(compute())
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    })
  })
}

if (import.meta.vitest) {
  describe(stream, () => {
    it('resolves a sync compute value', async () => {
      await expect(stream(() => 42)).resolves.toBe(42)
    })

    it('adopts an async compute (thenable)', async () => {
      await expect(stream(() => Promise.resolve('x'))).resolves.toBe('x')
    })

    it('defers the compute until after the current sync tick (shell can flush first)', async () => {
      let ran = false
      const promise = stream(() => {
        ran = true
        return 1
      })
      expect(ran).toBe(false) // did NOT run synchronously inside stream()
      await promise
      expect(ran).toBe(true)
    })

    it('routes a thrown error to rejection (for the page {:catch})', async () => {
      await expect(stream(() => {
        throw new Error('boom')
      })).rejects.toThrow('boom')
    })
  })
}
