/**
 * Leader election via the Web Locks API. Runs on the MAIN THREAD of every tab.
 *
 * Topology (see the repo's opfs-leader-worker knowledge page): exactly one tab per
 * origin holds the OPFS DB (an OPFS sync-access-handle is exclusive per file
 * across the origin). We elect that owner by having every tab request the SAME
 * exclusive Web Lock; the browser grants it to one tab and queues the rest. The
 * winner holds the lock for its lifetime (a never-resolving promise) and spawns
 * the leader worker. When the winner's tab/worker dies, the browser releases the
 * lock and grants it to the next waiter — which then promotes itself.
 *
 * Web Locks auto-release on tab close / crash with no cleanup needed, which is
 * exactly the seamless hand-off we want.
 */

export interface LeaderElection {
  /** True once this tab has been granted leadership. */
  readonly is_leader: boolean
  /** Voluntarily give up leadership (e.g. on teardown). */
  resign: () => void
  /**
   * Re-enter the election after a `resign()` (auto-recovery from a boot failure).
   * A no-op while already leading or a request is in flight — so it's safe to
   * call repeatedly on a backoff. When granted, `on_promote` fires again.
   */
  reacquire: () => void
}

export interface StartElectionOptions {
  /** Web Lock name — one per logical DB owner (e.g. `house-db-leader`). */
  lock_name: string
  /**
   * Called when THIS tab becomes the leader. May be called again after a
   * hand-off if leadership is re-acquired (only happens if `resign` was used and
   * the tab re-enters the election — by default a tab leads once until it dies).
   */
  on_promote: () => void | Promise<void>
}

export function start_leader_election({ lock_name, on_promote }: StartElectionOptions): LeaderElection {
  const state = { is_leader: false }
  let release_lock: (() => void) | null = null
  let requesting = false

  if (typeof navigator === 'undefined' || !navigator.locks) {
    // No Web Locks (very old browser / SSR). Degrade to "always leader" so a
    // single tab still works; multi-tab safety is then best-effort.
    state.is_leader = true
    void on_promote()
    return { get is_leader() { return state.is_leader }, resign() { /* noop */ }, reacquire() { /* already leader */ } }
  }

  // The promise returned to `request` stays pending while we hold the lock; the
  // lock is released when it resolves (via `resign`) or the context is destroyed.
  function request_lock(): void {
    if (requesting || state.is_leader)
      return
    requesting = true
    void navigator.locks.request(lock_name, { mode: 'exclusive' }, () =>
      new Promise<void>((resolve) => {
        requesting = false
        release_lock = resolve
        state.is_leader = true
        void on_promote()
      }),
    ).catch((err) => {
      requesting = false
      // AbortError on resign is expected; anything else is worth surfacing.
      if ((err as Error)?.name !== 'AbortError')
        console.error('[leader-election] lock request failed:', err)
    })
  }

  request_lock()

  return {
    get is_leader() { return state.is_leader },
    resign() {
      state.is_leader = false
      release_lock?.()
      release_lock = null
    },
    reacquire() {
      request_lock()
    },
  }
}
