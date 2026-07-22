/**
 * Browser-capability detection for the local-first DB **tier selection** AND for
 * **session telemetry** — we ship these flags in `session_start` (`remote-log.ts`)
 * so we can see which tier each session got, even anonymous, even if the DB later
 * fails to open. Before this, browser fitness was only inferable by eyeballing the
 * raw `user_agent`, and `has_opfs` was logged ONLY after the 20s leader timeout.
 *
 * Tiers (see `.issues/no-opfs-idb-fallback-tiers.md`):
 *   1. `opfs-worker` — OPFS sync-access-handle in a leader dedicated worker.
 *   2. `idb-worker`  — IndexedDB VFS in the SAME leader worker (no OPFS, Safari 15.4–15.6).
 *   3. `idb-main`    — IndexedDB on the MAIN THREAD (no Worker/BroadcastChannel, Safari <15.4).
 *
 * Everything here is read-only feature detection — safe on the main thread AND in
 * a worker, and never throws. NOTE: true OPFS-SAH support (`createSyncAccessHandle`)
 * is only PROVABLE inside a worker, so `has_opfs` here (a `getDirectory` presence
 * check) is necessary-not-sufficient; the worker confirms at runtime and downgrades
 * `opfs-worker` → `idb-worker` on an actual open failure.
 *
 * Additive, dependency-free, and copy-paste-ready for Living Dictionaries' dict-client.
 */

export interface DbCapabilities {
  /** OPFS root dir present (`navigator.storage.getDirectory`). */
  has_opfs: boolean
  /** Web Locks API — cross-tab leader election. */
  has_web_locks: boolean
  /** BroadcastChannel — the worker transport (leader↔tabs, AND leader↔its-own-worker). */
  has_broadcast_channel: boolean
  /** Dedicated `Worker` constructor. */
  has_worker: boolean
  /** IndexedDB — the Tier 2/3 storage backend. */
  has_indexed_db: boolean
}

export type DbTier = 'opfs-worker' | 'idb-worker' | 'idb-main'

function has(probe: () => boolean): boolean {
  try {
    return probe()
  } catch {
    return false
  }
}

export function detect_db_capabilities(): DbCapabilities {
  return {
    has_opfs: has(() => typeof navigator !== 'undefined' && !!navigator.storage && typeof navigator.storage.getDirectory === 'function'),
    has_web_locks: has(() => typeof navigator !== 'undefined' && !!navigator.locks),
    has_broadcast_channel: has(() => typeof BroadcastChannel !== 'undefined'),
    has_worker: has(() => typeof Worker !== 'undefined'),
    has_indexed_db: has(() => typeof indexedDB !== 'undefined'),
  }
}

/**
 * Which local-DB path can this browser run?
 *  - Worker + BroadcastChannel → run in the leader worker (OPFS if available, else IDB).
 *  - Otherwise, if IndexedDB exists → main-thread IDB (single-tab, best-effort).
 *  - Otherwise `null` → no local DB at all; caller uses the SSR/server floor.
 */
export function resolve_db_tier(caps: DbCapabilities = detect_db_capabilities()): DbTier | null {
  if (caps.has_worker && caps.has_broadcast_channel)
    return caps.has_opfs ? 'opfs-worker' : 'idb-worker'
  if (caps.has_indexed_db)
    return 'idb-main'
  return null
}

if (import.meta.vitest) {
  const caps = (over: Partial<DbCapabilities>): DbCapabilities => ({
    has_opfs: false,
    has_web_locks: false,
    has_broadcast_channel: false,
    has_worker: false,
    has_indexed_db: false,
    ...over,
  })

  describe(resolve_db_tier, () => {
    it('Tier 1 — OPFS + worker + BroadcastChannel', () => {
      expect(resolve_db_tier(caps({ has_opfs: true, has_worker: true, has_broadcast_channel: true, has_indexed_db: true }))).toBe('opfs-worker')
    })

    it('Tier 2 — no OPFS but worker + BroadcastChannel (Safari 15.4–15.6)', () => {
      expect(resolve_db_tier(caps({ has_worker: true, has_broadcast_channel: true, has_indexed_db: true }))).toBe('idb-worker')
    })

    it('Tier 3 — no BroadcastChannel, IndexedDB only (Safari <15.4)', () => {
      expect(resolve_db_tier(caps({ has_indexed_db: true, has_worker: true }))).toBe('idb-main')
    })

    it('falls to main-thread IDB when Worker is absent', () => {
      expect(resolve_db_tier(caps({ has_indexed_db: true, has_broadcast_channel: true }))).toBe('idb-main')
    })

    it('null (SSR floor) when not even IndexedDB exists', () => {
      expect(resolve_db_tier(caps({}))).toBe(null)
    })
  })
}
