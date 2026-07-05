/**
 * Main-thread proxy for "a snapshot_expired reset was recently in flight for
 * this dict". The reset itself runs inside the leader worker (which closes +
 * reopens the OPFS connection), so the main-thread bundle read can't observe it
 * directly. But `snapshot_expired` is broadcast to every tab (see
 * `[dictionaryId]/+layout.ts`), and it's exactly what triggers the in-worker
 * reset — so a recent broadcast is an honest signal that the connection was
 * being torn down when a concurrent `read_dict_bundle` hit SQLITE_MISUSE.
 *
 * Used to annotate the `Failed to read dict bundle` telemetry (2026-07-04 P1).
 */
const last_seen = new Map<string, number>()

/** Window within which a prior snapshot_expired broadcast still counts as "reset likely in flight". */
export const SNAPSHOT_EXPIRED_PROXY_WINDOW_MS = 30_000

export function mark_snapshot_expired(dict_id: string, now: number = Date.now()): void {
  last_seen.set(dict_id, now)
}

export function snapshot_expired_recently(dict_id: string, now: number = Date.now()): boolean {
  const at = last_seen.get(dict_id)
  return at !== undefined && now - at < SNAPSHOT_EXPIRED_PROXY_WINDOW_MS
}

/** Test-only. */
export function _reset_snapshot_expired_tracker_for_tests(): void {
  last_seen.clear()
}

if (import.meta.vitest) {
  describe(snapshot_expired_recently, () => {
    test('true within the window, false outside', () => {
      _reset_snapshot_expired_tracker_for_tests()
      mark_snapshot_expired('achi', 1_000)
      expect(snapshot_expired_recently('achi', 5_000)).toBe(true)
      expect(snapshot_expired_recently('achi', 1_000 + SNAPSHOT_EXPIRED_PROXY_WINDOW_MS + 1)).toBe(false)
    })
    test('false for an unseen dict', () => {
      _reset_snapshot_expired_tracker_for_tests()
      expect(snapshot_expired_recently('never')).toBe(false)
    })
  })
}
