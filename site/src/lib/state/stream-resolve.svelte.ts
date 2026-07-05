/**
 * Adopt a load value that is EITHER resolved data (SSR hard loads — public pages
 * keep crawlable HTML + instant first paint) OR a streamed promise (client-nav
 * data requests, where the server load returned `stream(...)` so navigation
 * transitions instantly). Pair with a server load like:
 *
 *   return { home_data: isDataRequest ? stream(compute) : compute() }
 *
 * `value` is:
 *   - the data synchronously when the load gave a plain value (SSR render +
 *     hydration — no flash, no hydration mismatch);
 *   - `undefined` while a streamed promise is pending on FIRST client-nav
 *     (render a skeleton);
 *   - STICKY across `invalidate()` re-runs: a new pending promise keeps the last
 *     resolved value visible instead of flashing the skeleton (edit → reload
 *     flows like the contributors page).
 *
 * Must be called during component init (it owns an `$effect`).
 */
export function stream_resolve<T>(get_value: () => T | Promise<T>): { readonly value: T | undefined, readonly error: unknown } {
  const initial = get_value()
  let current = $state<T | undefined>(initial instanceof Promise ? undefined : initial)
  let error = $state<unknown>(undefined)

  $effect(() => {
    const candidate = get_value()
    if (!(candidate instanceof Promise)) {
      current = candidate
      error = undefined
      return
    }
    candidate.then(
      (resolved) => {
        // Only adopt if this is still the latest load value (guards a fast
        // second invalidate racing an older promise).
        if (get_value() === candidate) {
          current = resolved
          error = undefined
        }
      },
      (err: unknown) => {
        if (get_value() === candidate)
          error = err
      },
    )
  })

  return {
    get value() { return current },
    get error() { return error },
  }
}
