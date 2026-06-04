import type { RequestHandler } from './$types'
import { gzipSync } from 'node:zlib'
import { unlink } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_by_url_or_id } from '$lib/db/server/get-dictionary'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { error } from '@sveltejs/kit'

/**
 * GET /api/dictionary/[id]/db
 *
 * Full snapshot of `dictionaries/{id}.db` — the wa-sqlite bootstrap fast-path
 * (the browser writes these bytes into OPFS, then opens with the OPFS VFS, then
 * syncs deltas via `/changes`).
 *
 * Read access mirrors the (retiring) entries-data endpoint: served to anyone
 * who can read the dictionary. Editors additionally push via `/changes`. (The
 * example gated this to editors with viewers on a public R2 bucket; LD has no
 * R2 yet, so the VPS endpoint serves everyone — R2 is far-future, not this port.)
 *
 * Uses `db.backup()` (page-by-page copy under a SHARED lock, safe under WAL),
 * gzips, streams back.
 */
export const GET: RequestHandler = async (event) => {
  const dict_id_or_url = event.params.id
  if (!dict_id_or_url)
    error(ResponseCodes.BAD_REQUEST, 'Missing dictionary id')

  const dictionary = get_dictionary_by_url_or_id(dict_id_or_url)
  if (!dictionary)
    error(ResponseCodes.NOT_FOUND, 'dictionary not found')

  const dict_db = get_dictionary_db(dictionary.id)

  const temp_path = join(tmpdir(), `dict-snapshot-${dictionary.id}-${crypto.randomUUID()}.db`)
  try {
    await dict_db.backup(temp_path)
    if (!existsSync(temp_path))
      error(ResponseCodes.INTERNAL_SERVER_ERROR, 'Snapshot file missing after backup')

    const bytes = readFileSync(temp_path)
    const gzipped = new Uint8Array(gzipSync(bytes))
    return new Response(gzipped, {
      headers: {
        'content-type': 'application/octet-stream',
        'content-encoding': 'gzip',
        'cache-control': 'no-store',
      },
    })
  } finally {
    try { await unlink(temp_path) } catch { /* best-effort */ }
  }
}
