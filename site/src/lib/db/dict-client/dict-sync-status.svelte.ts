import type { DictConnection } from './worker-connection'
import { online } from 'svelte/reactivity/window'

/**
 * Reactive mirror of the per-dict leader worker's `DictSyncEngine` status, for
 * the sidebar sync cloud (`DictSyncStatus.svelte`). The engine itself runs
 * inside the leader worker (see `dict-sync-engine.ts`), so this class doesn't
 * sync anything — it just listens to the `sync_status` broadcast the worker
 * already emits (`dict-instance.ts` `on_status`) and exposes it as Svelte 5
 * state, plus a `sync_now()` pass-through for tap-to-sync.
 *
 * One instance per open dict, cached alongside `connection`/`dict_db` in
 * `[dictionaryId]/+layout.ts` (survives layout invalidation).
 */
export class DictSyncStatus {
  is_syncing = $state(false)
  last_error: string | null = $state(null)
  last_sync_at: string | null = $state(null)
  /** True from the moment a manual tap fires until the RPC settles — covers
   *  the round-trip gap before the worker's `sync_status` broadcast confirms
   *  `is_syncing`, so a double-tap can't queue a second request. */
  #triggering = $state(false)

  #connection: DictConnection
  #unsubscribe: (() => void) | null = null

  constructor(connection: DictConnection) {
    this.#connection = connection
    this.#unsubscribe = connection.subscribe_broadcasts((broadcast) => {
      if (broadcast.type === 'sync_status') {
        this.is_syncing = broadcast.is_syncing
        this.last_error = broadcast.last_error
        this.last_sync_at = broadcast.last_sync_at
      }
    })
  }

  get online(): boolean {
    return online.current ?? true
  }

  /** Syncing right now, OR a manual trigger is in flight awaiting confirmation. */
  get busy(): boolean {
    return this.is_syncing || this.#triggering
  }

  /** Tap-to-sync. No-ops while already busy (background timer, another tap, …). */
  async sync_now(): Promise<void> {
    if (this.busy)
      return
    this.#triggering = true
    try {
      await this.#connection.sync_now()
    } finally {
      this.#triggering = false
    }
  }

  destroy(): void {
    this.#unsubscribe?.()
    this.#unsubscribe = null
  }
}

export type DictSyncCloudStatus = 'offline' | 'syncing' | 'error' | 'synced' | 'idle'

/** Pure status derivation, split out for easy testing (mirrors tutor's `pick_status`). */
export function pick_dict_sync_status({ online, busy, last_error, last_sync_at }: {
  online: boolean
  busy: boolean
  last_error: string | null
  last_sync_at: string | null
}): DictSyncCloudStatus {
  if (!online)
    return 'offline'
  if (busy)
    return 'syncing'
  if (last_error)
    return 'error'
  if (last_sync_at)
    return 'synced'
  return 'idle'
}

if (import.meta.vitest) {
  describe(pick_dict_sync_status, () => {
    it('offline wins even mid-sync', () => {
      expect(pick_dict_sync_status({ online: false, busy: true, last_error: null, last_sync_at: null })).toBe('offline')
    })
    it('busy (syncing or a manual trigger in flight) shows syncing', () => {
      expect(pick_dict_sync_status({ online: true, busy: true, last_error: null, last_sync_at: null })).toBe('syncing')
    })
    it('a last_error with no in-flight sync shows error', () => {
      expect(pick_dict_sync_status({ online: true, busy: false, last_error: 'boom', last_sync_at: '2026-01-01' })).toBe('error')
    })
    it('a clean last_sync_at with no error shows synced', () => {
      expect(pick_dict_sync_status({ online: true, busy: false, last_error: null, last_sync_at: '2026-01-01' })).toBe('synced')
    })
    it('never synced yet shows idle', () => {
      expect(pick_dict_sync_status({ online: true, busy: false, last_error: null, last_sync_at: null })).toBe('idle')
    })
  })
}
