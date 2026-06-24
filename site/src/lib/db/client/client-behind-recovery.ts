/**
 * Recovery policy for a CLIENT_BEHIND sync block (the app bundle is older than
 * the server's migration head).
 *
 * The trap this breaks: the admin sync engine runs in ONE leader dedicated
 * worker per origin. If another tab still holds the leader on an OLD bundle,
 * reloading a single tab just makes it a follower of that stale leader — the
 * version mismatch never clears, so the user is stuck in a "reload doesn't help"
 * loop. The cure is to broadcast the signal to EVERY tab and have them all
 * reload: that destroys the leader tab's document → its worker dies → the Web
 * Lock frees → a fresh leader boots on the new bundle.
 *
 * Loop guard: auto-reload at most once per `RELOAD_WINDOW_MS`. If the signal
 * recurs within the window, the reload didn't pick up newer code (stale
 * SW/CDN, or a genuinely unavailable bundle) — stop reloading and let the caller
 * surface a manual-reload toast instead. The guard lives in sessionStorage
 * (per-tab, cleared on close), so each tab self-limits and a fresh open starts
 * clean.
 */

/** sessionStorage key holding the last auto-reload timestamp (ms epoch). */
export const CLIENT_BEHIND_GUARD_KEY = 'client_behind_reload_at'

/** Suppress a second auto-reload within this window — the first didn't help. */
export const RELOAD_WINDOW_MS = 30_000

export interface ReloadGuard {
  /** ms epoch of the last auto-reload this tab triggered. */
  at: number
}

export type RecoveryDecision
  = | { action: 'reload', next: ReloadGuard }
    | { action: 'toast' }

/**
 * Pure decision: reload now (and persist `next`) or fall back to a toast.
 * Side-effect free so it's unit-testable; the caller does the sessionStorage
 * read/write + `location.reload()`.
 */
export function decide_client_behind_recovery({ stored, now, window_ms = RELOAD_WINDOW_MS }: {
  stored: ReloadGuard | null
  now: number
  window_ms?: number
}): RecoveryDecision {
  if (stored && now - stored.at < window_ms)
    return { action: 'toast' }
  return { action: 'reload', next: { at: now } }
}

if (import.meta.vitest) {
  describe(decide_client_behind_recovery, () => {
    test('reloads on first signal (no prior guard)', () => {
      const decision = decide_client_behind_recovery({ stored: null, now: 1000 })
      expect(decision).toEqual({ action: 'reload', next: { at: 1000 } })
    })

    test('toasts when the same signal recurs inside the window', () => {
      const decision = decide_client_behind_recovery({ stored: { at: 1000 }, now: 1000 + RELOAD_WINDOW_MS - 1 })
      expect(decision).toEqual({ action: 'toast' })
    })

    test('reloads again once the window has elapsed (a later genuine deploy)', () => {
      const decision = decide_client_behind_recovery({ stored: { at: 1000 }, now: 1000 + RELOAD_WINDOW_MS })
      expect(decision).toEqual({ action: 'reload', next: { at: 1000 + RELOAD_WINDOW_MS } })
    })
  })
}
