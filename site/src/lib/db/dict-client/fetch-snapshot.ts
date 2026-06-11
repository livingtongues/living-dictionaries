import type { AuthHeaders } from './worker/instance'
import { r2_dict_snapshot_key } from '$lib/constants'

/**
 * Fetch a `dictionaries/{id}.db` snapshot. Branches:
 *   - Editor → `GET /api/dictionary/[id]/db` with auth (fresh from VPS).
 *   - Viewer → `GET https://snapshots.livingdictionaries.app/dictionaries/{id}.db.gz`
 *              (public R2 bucket, 2-min CDN cache; possibly up to 30 min stale).
 *
 * Both return raw .db bytes (gunzipped). The caller writes them to OPFS, then
 * opens with wa-sqlite's OPFS VFS.
 *
 * The R2 URL is built from `r2_dict_snapshot_key`; the R2 base URL defaults to
 * the production CNAME but can be overridden per call (staging vs prod).
 */

const R2_SNAPSHOT_BASE_URL = 'https://snapshots.livingdictionaries.app'

export interface FetchSnapshotOptions {
  dict_id: string
  has_editor_role: boolean
  auth: AuthHeaders
  /** Override the R2 base URL (defaults to production). */
  r2_base_url?: string
  signal?: AbortSignal
}

export interface FetchedSnapshot {
  /** Raw .db file bytes (already gunzipped if the response was gzipped). */
  bytes: Uint8Array
  /** Source we fetched from — useful for telemetry / diagnostics. */
  source: 'vps' | 'r2'
}

export async function fetch_dict_snapshot(options: FetchSnapshotOptions): Promise<FetchedSnapshot> {
  const fetched = options.has_editor_role
    ? await fetch_from_vps(options)
    : await fetch_from_r2(options)
  normalize_snapshot_header(fetched.bytes)
  return fetched
}

/**
 * The browser's single-file OPFS sync-access-handle VFS can only open a
 * rollback-journal database (header writer/read version = 1). A snapshot built
 * via better-sqlite3 `backup()` from a WAL-mode source carries WAL versions (2)
 * even though the bytes are a complete single-file copy with NO `-wal` sidecar —
 * so the WAL flag is cosmetic and SQLite would treat the WAL as empty. Flip the
 * two header version bytes to 1 in place, which is exactly the header state
 * `PRAGMA journal_mode = DELETE` produces. Without this, OPFS open fails
 * (SQLITE_CANTOPEN) and the client falls back to MemoryVFS + re-downloads every
 * boot. Belt-and-braces alongside the server-side `journal_mode = DELETE` fix —
 * covers legacy snapshots built before that landed.
 */
function normalize_snapshot_header(bytes: Uint8Array): void {
  // Offset 0: "SQLite format 3\0"; offsets 18/19: file format write/read version.
  if (bytes.length < 20)
    return
  const is_sqlite = bytes[0] === 0x53 && bytes[1] === 0x51 && bytes[2] === 0x4C && bytes[3] === 0x69 // "SQLi"
  if (!is_sqlite)
    return
  if (bytes[18] === 2) bytes[18] = 1
  if (bytes[19] === 2) bytes[19] = 1
}

async function fetch_from_vps({ dict_id, auth, signal }: FetchSnapshotOptions): Promise<FetchedSnapshot> {
  const headers: Record<string, string> = {}
  if (auth.bearer)
    headers.Authorization = `Bearer ${auth.bearer}`

  // Browser flow: the `session` cookie auto-attaches to same-origin fetch from
  // the leader worker. `credentials: 'include'` is belt-and-braces — some
  // hosting setups proxy the worker through a different origin.
  const response = await fetch(`/api/dictionary/${dict_id}/db`, { headers, credentials: 'include', signal })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`VPS snapshot fetch failed (${response.status}): ${detail.slice(0, 200)}`)
  }
  // The endpoint sets Content-Encoding: gzip; fetch transparently decodes it.
  const buffer = await response.arrayBuffer()
  return { bytes: new Uint8Array(buffer), source: 'vps' }
}

async function fetch_from_r2({ dict_id, r2_base_url, signal }: FetchSnapshotOptions): Promise<FetchedSnapshot> {
  const base = r2_base_url || R2_SNAPSHOT_BASE_URL
  const url = `${base}/${r2_dict_snapshot_key(dict_id)}`
  const response = await fetch(url, { signal })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`R2 snapshot fetch failed (${response.status}): ${detail.slice(0, 200)}`)
  }
  // R2 sets Content-Encoding: gzip; fetch transparently decodes.
  const buffer = await response.arrayBuffer()
  return { bytes: new Uint8Array(buffer), source: 'r2' }
}
