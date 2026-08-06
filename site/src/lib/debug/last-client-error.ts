/**
 * A one-slot handoff from `hooks.client.ts` to `routes/+error.svelte`.
 *
 * The client error hook sees the REAL exception; the error page sees only
 * SvelteKit's sanitized `{ message: 'Internal Error' }`. Parking the cause here
 * for the moment in between lets the `crash` row name what actually broke —
 * which is the whole difference between an actionable log review and one that
 * has to replay sessions by hand (2026-08-01: 399 of 403 "Internal Error" rows
 * in production had no recorded cause at all).
 *
 * Deliberately one slot, deliberately consumed on read: the error page mounts
 * immediately after the hook runs, and a stale cause on a LATER error page would
 * be worse than none.
 */

interface ClientErrorCause {
  message: string
  stack: string | null
  at: number
}

/** Beyond this, assume the cause belongs to an earlier failure, not this page. */
const MAX_AGE_MS = 10_000

let pending: ClientErrorCause | null = null

export function remember_client_error({ message, stack }: { message: string, stack: string | null }): void {
  pending = { message, stack, at: Date.now() }
}

/** Read + clear. Returns null when nothing was parked, or it's gone stale. */
export function take_client_error(): { message: string, stack: string | null } | null {
  const cause = pending
  pending = null
  if (!cause || Date.now() - cause.at > MAX_AGE_MS)
    return null
  return { message: cause.message, stack: cause.stack }
}

if (import.meta.vitest) {
  describe(take_client_error, () => {
    it('hands the parked cause to the next reader exactly once', () => {
      remember_client_error({ message: 'boom', stack: 'at x' })
      expect(take_client_error()).toEqual({ message: 'boom', stack: 'at x' })
      expect(take_client_error()).toBe(null)
    })

    it('drops a cause older than the handoff window', () => {
      remember_client_error({ message: 'old', stack: null })
      vi.useFakeTimers()
      vi.setSystemTime(new Date(Date.now() + MAX_AGE_MS + 1))
      expect(take_client_error()).toBe(null)
      vi.useRealTimers()
    })

    it('returns null when nothing was parked', () => {
      expect(take_client_error()).toBe(null)
    })
  })
}
