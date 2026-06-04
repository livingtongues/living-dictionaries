import type { AuthHeaders } from './rpc-types'

/**
 * Fetch a `dictionaries/{id}.db` snapshot from the VPS endpoint
 * (`GET /api/dictionary/[id]/db`). The caller writes the returned bytes to OPFS,
 * then opens with wa-sqlite's OPFS VFS.
 *
 * The example branched editors → VPS vs viewers → a public R2 bucket. LD has no
 * R2 yet (far-future), so EVERYONE fetches from the VPS endpoint, which serves
 * the snapshot publicly (mirrors the retiring entries-data endpoint).
 */

export interface FetchSnapshotOptions {
  dict_id: string
  has_editor_role: boolean
  auth: AuthHeaders
  signal?: AbortSignal
}

export interface FetchedSnapshot {
  /** Raw .db file bytes (already gunzipped by fetch). */
  bytes: Uint8Array
  source: 'vps'
}

export async function fetch_dict_snapshot(options: FetchSnapshotOptions): Promise<FetchedSnapshot> {
  const { dict_id, auth, signal } = options
  const headers: Record<string, string> = {}
  if (auth.bearer)
    headers.Authorization = `Bearer ${auth.bearer}`

  // Browser flow: the `session` cookie auto-attaches to same-origin fetch from
  // the SharedWorker. `credentials: 'include'` is belt-and-braces.
  const response = await fetch(`/api/dictionary/${dict_id}/db`, { headers, credentials: 'include', signal })
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Snapshot fetch failed (${response.status}): ${detail.slice(0, 200)}`)
  }
  // The endpoint sets Content-Encoding: gzip; fetch transparently decodes it.
  const buffer = await response.arrayBuffer()
  return { bytes: new Uint8Array(buffer), source: 'vps' }
}
