import { DICT_DB_OPFS_PREFIX, VIEWER_OPFS_BUDGET_BYTES } from '$lib/constants'

/**
 * LRU eviction for viewer-only dict.db files in OPFS (Story B.1 — 200 MB
 * total budget). Editor dicts are exempt because evicting one would drop
 * unpushed dirty rows.
 *
 * Eviction state is tracked in an IndexedDB store (`dict-opfs-lru`) so it
 * survives page reloads. Each open dict updates its `last_accessed_at` on
 * every `touch()` call (typically once per open). When total OPFS bytes for
 * tracked viewer dicts exceeds the budget, the oldest non-exempt dict gets
 * its OPFS file deleted (and its entry removed from the LRU map).
 */

const IDB_NAME = 'dict-opfs-lru'
const STORE_NAME = 'entries'

interface LruEntry {
  dict_id: string
  last_accessed_at: number // ms epoch
  size_bytes: number // size of the OPFS file at last touch
  is_editor: boolean // editor dicts are exempt
}

async function open_idb(): Promise<IDBDatabase> {
  return await new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open(IDB_NAME, 1)
    open.onupgradeneeded = () => {
      open.result.createObjectStore(STORE_NAME, { keyPath: 'dict_id' })
    }
    open.onsuccess = () => resolve(open.result)
    open.onerror = () => reject(open.error)
  })
}

async function read_all(): Promise<LruEntry[]> {
  const db = await open_idb()
  try {
    return await new Promise<LruEntry[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result as LruEntry[])
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

async function put_entry(entry: LruEntry): Promise<void> {
  const db = await open_idb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.put(entry)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

async function delete_entry(dict_id: string): Promise<void> {
  const db = await open_idb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const request = store.delete(dict_id)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

async function get_opfs_size(dict_id: string): Promise<number> {
  try {
    const root = await navigator.storage.getDirectory()
    const dir = await root.getDirectoryHandle('dictionaries').catch(() => null)
    if (!dir)
      return 0
    const file = await dir.getFileHandle(`${dict_id}.db`).catch(() => null)
    if (!file)
      return 0
    const f = await file.getFile()
    return f.size
  } catch {
    return 0
  }
}

async function delete_opfs_file(dict_id: string): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory()
    const dir = await root.getDirectoryHandle('dictionaries').catch(() => null)
    if (!dir)
      return
    await dir.removeEntry(`${dict_id}.db`).catch(() => { /* not there */ })
  } catch { /* best-effort */ }
}

/**
 * Mark a dict as touched (sets `last_accessed_at = now`, refreshes size).
 * Call this on every successful `open()`.
 */
export async function touch_dict({ dict_id, is_editor }: { dict_id: string, is_editor: boolean }): Promise<void> {
  const size_bytes = await get_opfs_size(dict_id)
  await put_entry({
    dict_id,
    last_accessed_at: Date.now(),
    size_bytes,
    is_editor,
  })
}

/**
 * Drop the LRU entry for a dict (without deleting the underlying OPFS file).
 * Used when promoting a dict from viewer → editor (it stops being eligible
 * for eviction and we no longer need to track its size).
 */
export async function untrack_dict(dict_id: string): Promise<void> {
  await delete_entry(dict_id)
}

/**
 * Evict the least-recently-used non-editor entries until total bytes fit
 * under `VIEWER_OPFS_BUDGET_BYTES`. Skips entries currently held in the
 * SharedWorker (caller passes via `open_dict_ids` to prevent yanking a file
 * out from under an active connection).
 *
 * Returns the list of dict_ids that were evicted (caller can broadcast
 * `snapshot_expired` to any tabs still on those dicts).
 */
export async function evict_if_over_budget({ open_dict_ids }: { open_dict_ids: ReadonlySet<string> }): Promise<string[]> {
  const entries = await read_all()
  const viewers = entries
    .filter(e => !e.is_editor && !open_dict_ids.has(e.dict_id))
    .sort((a, b) => a.last_accessed_at - b.last_accessed_at)

  let total = entries.reduce((sum, entry) => sum + (entry.is_editor ? 0 : entry.size_bytes), 0)
  const evicted: string[] = []
  for (const entry of viewers) {
    if (total <= VIEWER_OPFS_BUDGET_BYTES)
      break
    await delete_opfs_file(entry.dict_id)
    await delete_entry(entry.dict_id)
    total -= entry.size_bytes
    evicted.push(entry.dict_id)
  }
  return evicted
}

/** For tests / diagnostics. */
export const _LRU_INTERNALS = {
  read_all,
  delete_entry,
  get_opfs_size,
  prefix: DICT_DB_OPFS_PREFIX,
}
