/**
 * Pure sync-failure classification shared by the main-thread admin engine
 * reporter (`./report-sync-failure.ts`) and the worker-side dict engine
 * reporter (`../dict-client/report-dict-sync-failure.ts`). No remote-log
 * import — must stay loadable inside the leader dedicated worker.
 *
 * Level policy (shared across house/tutor/LD, 2026-07-02):
 *   version blocks / network / auth / snapshot lifecycle → warn
 *   corruption / everything else                        → error
 */
import { ClientBehindError, ServerBehindError } from './errors'

export type SyncFailureKind
  = | 'corruption'
    | 'client_behind'
    | 'server_behind'
    | 'network'
    | 'auth'
    | 'snapshot_expired'
    | 'storage_lost'
    | 'other'

/** Suppress repeat-identical throttled-kind rows (same kind+message) within this window. */
export const SYNC_FAILURE_THROTTLE_MS = 10 * 60 * 1000

const WARN_KINDS: ReadonlySet<SyncFailureKind> = new Set(['client_behind', 'server_behind', 'network', 'auth', 'snapshot_expired', 'storage_lost'])
/**
 * Kinds subject to repeat-suppression (auto-retrying flows); hard failures
 * always ship. `client_behind` joined this set 2026-07-05: the dict engine's
 * 30s auto-retry has no blocked-state guard (see `DictSyncEngine`/
 * `dict-instance.ts`), so an un-reloaded tab used to ship an UNTHROTTLED
 * `sync_failed` row every 30s forever — one stuck tab drove 9,681 rows (41.9%
 * of a day's total log volume) before this was caught
 * (`.issues/dict-sync-client-behind-storm-2026-07-05.md`). Throttling here is
 * the immediate flood mitigation; the durable fix (stop retrying / actually
 * recover) is tracked separately in that issue.
 */
const THROTTLED_KINDS: ReadonlySet<SyncFailureKind> = new Set(['network', 'server_behind', 'auth', 'snapshot_expired', 'storage_lost', 'client_behind'])

/**
 * The browser closed our held OPFS sync-access-handle out from under the leader
 * worker (observed 2026-07-03: a backgrounded tab's worker woke with a dead
 * handle and hot-looped `AccessHandle is closed` every 30s for 80 min). Chrome
 * throws `InvalidStateError: The access handle was already closed`; wa-sqlite/
 * WebKit surface `AccessHandle is closed`. The dict instance self-heals by
 * reopening the connection in place (`dict-instance.ts`), so telemetry-wise
 * this is a benign lifecycle event: warn + throttled.
 */
export function is_storage_lost_error(error: unknown): boolean {
  const message = (error as { message?: unknown } | null | undefined)?.message
  if (typeof message !== 'string')
    return false
  return /access ?handle[^.]*closed|database connection is closing/i.test(message)
}

export function classify_sync_failure(error: unknown): SyncFailureKind {
  if (error instanceof ClientBehindError)
    return 'client_behind'
  if (error instanceof ServerBehindError)
    return 'server_behind'
  // Dict engine sentinels travel as `code` on a plain Error (see dict-sync-engine #post).
  const code = (error as { code?: unknown } | null | undefined)?.code
  if (code === 'schema_outdated')
    return 'client_behind'
  if (code === 'server_outdated')
    return 'server_behind'
  if (code === 'snapshot_expired')
    return 'snapshot_expired'
  if (code === 'unauthorized' || code === 'role_revoked')
    return 'auth'
  // Edge/gateway 5xx during a deploy swap (Cloudflare 520–527, 502 Bad Gateway,
  // 504 Gateway Timeout) arrive as a transient HTML interstitial — the origin was
  // briefly unreachable, NOT a real app fault. Treat as `network` (warn +
  // throttled) so a redeploy blip doesn't ship a burst of `error` rows. 503 is
  // left to the `server_outdated` code path above; a bare 500 from our own
  // endpoint stays `other` (a real fault worth surfacing).
  const status = (error as { status?: unknown } | null | undefined)?.status
  if (typeof status === 'number' && (status === 502 || status === 504 || (status >= 520 && status <= 527)))
    return 'network'
  if (is_storage_lost_error(error))
    return 'storage_lost'
  const message = (error as { message?: unknown } | null | undefined)?.message
  if (typeof message === 'string') {
    if (/not a database|disk image is malformed|file is not a database|\bcorrupt/i.test(message))
      return 'corruption'
    // post_request collapses fetch rejections to these prefixes; the dict
    // engine's raw fetch rejects with the browser-native messages.
    if (/^Network error:|^Request timed out|Failed to fetch|NetworkError|Load failed/i.test(message))
      return 'network'
    // Fallback for paths that lost the numeric `status` (e.g. main-thread
    // admin engine): match the Cloudflare/edge 5xx interstitial body itself.
    if (/web server is returning|error code 5\d\d/i.test(message))
      return 'network'
  }
  return 'other'
}

export function sync_failure_level(kind: SyncFailureKind): 'warn' | 'error' {
  return WARN_KINDS.has(kind) ? 'warn' : 'error'
}

/**
 * Kinds expected to self-heal without code/data changes: connectivity blips, a
 * mid-deploy server, a browser-closed OPFS handle (the instance reopens it), a
 * token refresh (`auth`), and `snapshot_expired` (the worker auto-resets in
 * place). These must NEVER trip the repeat-failure circuit breaker — offline
 * for an hour is 120 identical failures and completely normal.
 */
const TRANSIENT_KINDS: ReadonlySet<SyncFailureKind> = new Set(['network', 'server_behind', 'storage_lost', 'auth', 'snapshot_expired'])

export function is_transient_failure(kind: SyncFailureKind): boolean {
  return TRANSIENT_KINDS.has(kind)
}

/** Consecutive identical non-transient failures before an engine halts retrying. */
export const REPEAT_FAILURE_HALT_THRESHOLD = 3

/**
 * Repeat-fatal circuit breaker POLICY (cross-app hardening Part 2, mirrored
 * from house). A repeated same-signature fatal failure — e.g. a UNIQUE
 * collision the merge can't resolve — used to retry silently forever: the 30s
 * interval / auto-flush re-pushed the identical doomed payload while the
 * editor kept working, unaware (house's Wayne wedge ran ~7h). Engines feed
 * every failure here; after `REPEAT_FAILURE_HALT_THRESHOLD` identical
 * consecutive non-transient failures they latch a repeated-failure block
 * (stop retrying, surface a "keeps failing — reload / contact us" prompt).
 *
 * - transient kinds never halt AND reset the streak (an intervening blip means
 *   the fatal wasn't consecutive);
 * - `client_behind` has its own latch that stops the engine first — counted
 *   anyway (harmless belt + suspenders);
 * - a successful sync resets via `reset()`.
 */
export class RepeatFailureTracker {
  #key: string | null = null
  #count = 0

  /** Feed one failure; returns the halt decision + current streak length. */
  record({ kind, message }: { kind: SyncFailureKind, message: string }): { halt: boolean, consecutive: number } {
    if (is_transient_failure(kind)) {
      this.reset()
      return { halt: false, consecutive: 0 }
    }
    const key = `${kind}:${message}`
    this.#count = key === this.#key ? this.#count + 1 : 1
    this.#key = key
    return { halt: this.#count >= REPEAT_FAILURE_HALT_THRESHOLD, consecutive: this.#count }
  }

  reset(): void {
    this.#key = null
    this.#count = 0
  }
}

/** Pure throttle decision — ship unless an identical throttled-kind failure shipped within the window. */
export function should_ship_failure({ kind, message, last, now }: {
  kind: SyncFailureKind
  message: string
  last: { key: string, at: number } | null
  now: number
}): boolean {
  if (!THROTTLED_KINDS.has(kind))
    return true
  if (!last || last.key !== `${kind}:${message}`)
    return true
  return now - last.at >= SYNC_FAILURE_THROTTLE_MS
}

if (import.meta.vitest) {
  describe(classify_sync_failure, () => {
    test('classifies admin-engine version errors by class', () => {
      expect(classify_sync_failure(new ClientBehindError('Client bundle is out of date'))).toBe('client_behind')
      expect(classify_sync_failure(new ServerBehindError('Server bundle is behind'))).toBe('server_behind')
    })
    test('classifies dict-engine sentinels by code', () => {
      expect(classify_sync_failure(Object.assign(new Error('x'), { code: 'schema_outdated' }))).toBe('client_behind')
      expect(classify_sync_failure(Object.assign(new Error('x'), { code: 'server_outdated' }))).toBe('server_behind')
      expect(classify_sync_failure(Object.assign(new Error('x'), { code: 'snapshot_expired' }))).toBe('snapshot_expired')
      expect(classify_sync_failure(Object.assign(new Error('x'), { code: 'unauthorized' }))).toBe('auth')
      expect(classify_sync_failure(Object.assign(new Error('x'), { code: 'role_revoked' }))).toBe('auth')
    })
    test('classifies corruption by message', () => {
      expect(classify_sync_failure(new Error('database disk image is malformed'))).toBe('corruption')
      expect(classify_sync_failure(new Error('file is not a database'))).toBe('corruption')
    })
    test('classifies transport failures as network', () => {
      expect(classify_sync_failure(new TypeError('Failed to fetch'))).toBe('network')
      expect(classify_sync_failure(new Error('Network error: Load failed'))).toBe('network')
    })
    test('classifies edge/gateway 5xx (deploy-swap interstitials) as network by status', () => {
      const cf_520 = Object.assign(new Error('<!DOCTYPE html>… 520: Web server is returning an unknown error'), { status: 520 })
      expect(classify_sync_failure(cf_520)).toBe('network')
      expect(classify_sync_failure(Object.assign(new Error('x'), { status: 502 }))).toBe('network')
      expect(classify_sync_failure(Object.assign(new Error('x'), { status: 504 }))).toBe('network')
      expect(classify_sync_failure(Object.assign(new Error('x'), { status: 527 }))).toBe('network')
    })
    test('matches the CF interstitial body when status is absent', () => {
      expect(classify_sync_failure(new Error('livingdictionaries.app | 520: Web server is returning an unknown error'))).toBe('network')
      expect(classify_sync_failure(new Error('<html>… Error code 522 …</html>'))).toBe('network')
    })
    test('a bare app 500 stays other (a real fault worth surfacing)', () => {
      expect(classify_sync_failure(Object.assign(new Error('Internal Error'), { status: 500 }))).toBe('other')
    })
    test('classifies a browser-closed OPFS access handle as storage_lost', () => {
      expect(classify_sync_failure(new Error('AccessHandle is closed'))).toBe('storage_lost')
      expect(classify_sync_failure(new Error('The access handle was already closed.'))).toBe('storage_lost')
      expect(classify_sync_failure(new Error('The database connection is closing.'))).toBe('storage_lost')
    })
    test('everything else is other', () => {
      expect(classify_sync_failure(new Error('FOREIGN KEY constraint failed'))).toBe('other')
      expect(classify_sync_failure(null)).toBe('other')
    })
  })

  describe(sync_failure_level, () => {
    test('warn for expected/lifecycle kinds; error for corruption/other', () => {
      expect(sync_failure_level('client_behind')).toBe('warn')
      expect(sync_failure_level('server_behind')).toBe('warn')
      expect(sync_failure_level('network')).toBe('warn')
      expect(sync_failure_level('auth')).toBe('warn')
      expect(sync_failure_level('snapshot_expired')).toBe('warn')
      expect(sync_failure_level('storage_lost')).toBe('warn')
      expect(sync_failure_level('corruption')).toBe('error')
      expect(sync_failure_level('other')).toBe('error')
    })
  })

  describe(RepeatFailureTracker, () => {
    test('halts after 3 identical consecutive non-transient failures', () => {
      const tracker = new RepeatFailureTracker()
      expect(tracker.record({ kind: 'other', message: 'UNIQUE constraint failed: entry_tags.entry_id' })).toEqual({ halt: false, consecutive: 1 })
      expect(tracker.record({ kind: 'other', message: 'UNIQUE constraint failed: entry_tags.entry_id' })).toEqual({ halt: false, consecutive: 2 })
      expect(tracker.record({ kind: 'other', message: 'UNIQUE constraint failed: entry_tags.entry_id' })).toEqual({ halt: true, consecutive: 3 })
    })

    test('a different message restarts the streak', () => {
      const tracker = new RepeatFailureTracker()
      tracker.record({ kind: 'other', message: 'a' })
      tracker.record({ kind: 'other', message: 'a' })
      expect(tracker.record({ kind: 'other', message: 'b' })).toEqual({ halt: false, consecutive: 1 })
    })

    test('transient kinds never halt and reset the streak (offline forever must keep retrying)', () => {
      const tracker = new RepeatFailureTracker()
      tracker.record({ kind: 'other', message: 'a' })
      tracker.record({ kind: 'other', message: 'a' })
      expect(tracker.record({ kind: 'network', message: 'Failed to fetch' })).toEqual({ halt: false, consecutive: 0 })
      expect(tracker.record({ kind: 'other', message: 'a' })).toEqual({ halt: false, consecutive: 1 })
      for (let i = 0; i < 50; i++)
        expect(tracker.record({ kind: 'network', message: 'Failed to fetch' }).halt).toBe(false)
    })

    test('reset() clears the streak (successful sync)', () => {
      const tracker = new RepeatFailureTracker()
      tracker.record({ kind: 'other', message: 'a' })
      tracker.record({ kind: 'other', message: 'a' })
      tracker.reset()
      expect(tracker.record({ kind: 'other', message: 'a' })).toEqual({ halt: false, consecutive: 1 })
    })
  })

  describe(is_transient_failure, () => {
    test('self-healing kinds are transient; latched + fatal kinds are not', () => {
      expect(is_transient_failure('network')).toBe(true)
      expect(is_transient_failure('server_behind')).toBe(true)
      expect(is_transient_failure('storage_lost')).toBe(true)
      expect(is_transient_failure('auth')).toBe(true)
      expect(is_transient_failure('snapshot_expired')).toBe(true)
      expect(is_transient_failure('client_behind')).toBe(false)
      expect(is_transient_failure('corruption')).toBe(false)
      expect(is_transient_failure('other')).toBe(false)
    })
  })

  describe(should_ship_failure, () => {
    const now = 1_000_000
    test('always ships hard failures, even repeats', () => {
      expect(should_ship_failure({ kind: 'other', message: 'x', last: { key: 'other:x', at: now - 1 }, now })).toBe(true)
      expect(should_ship_failure({ kind: 'corruption', message: 'x', last: { key: 'corruption:x', at: now - 1 }, now })).toBe(true)
    })
    test('suppresses a repeat network failure inside the window', () => {
      expect(should_ship_failure({ kind: 'network', message: 'x', last: { key: 'network:x', at: now - 1 }, now })).toBe(false)
    })
    test('suppresses a repeat storage_lost failure inside the window (no 30s hot-loop rows)', () => {
      expect(should_ship_failure({ kind: 'storage_lost', message: 'AccessHandle is closed', last: { key: 'storage_lost:AccessHandle is closed', at: now - 1 }, now })).toBe(false)
    })
    test('suppresses a repeat client_behind failure inside the window (2026-07-05 storm fix — no 30s hot-loop rows)', () => {
      expect(should_ship_failure({ kind: 'client_behind', message: 'schema_outdated', last: { key: 'client_behind:schema_outdated', at: now - 1 }, now })).toBe(false)
    })
    test('ships again after the window / for a different message', () => {
      expect(should_ship_failure({ kind: 'network', message: 'x', last: { key: 'network:x', at: now - SYNC_FAILURE_THROTTLE_MS }, now })).toBe(true)
      expect(should_ship_failure({ kind: 'network', message: 'y', last: { key: 'network:x', at: now - 1 }, now })).toBe(true)
    })
  })
}
