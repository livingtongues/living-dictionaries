import type { AuthHeaders } from './rpc-types'
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
 * The R2 URL is built from `r2_dict_snapshot_key`; the R2 base URL is held in
 * `R2_SNAPSHOT_BASE_URL` (env-configurable at the call site to support staging
 * vs prod). Defaults to the production CNAME.
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
  if (options.has_editor_role)
    return await fetch_from_vps(options)
  return await fetch_from_r2(options)
}

async function fetch_from_vps({ dict_id, auth, signal }: FetchSnapshotOptions): Promise<FetchedSnapshot> {
  const headers: Record<string, string> = {}
  if (auth.bearer)
    headers.Authorization = `Bearer ${auth.bearer}`

  // Browser flow: the `session` cookie auto-attaches to same-origin fetch from
  // the SharedWorker. `credentials: 'include'` is belt-and-braces — some
  // hosting setups proxy the SharedWorker through a different origin.
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
