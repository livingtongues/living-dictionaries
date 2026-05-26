import type { RequestHandler } from './$types'
import { gzipSync } from 'node:zlib'
import { unlink } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { verify_auth_dict_role } from '$lib/auth/verify-dict-role'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { error } from '@sveltejs/kit'

/**
 * GET /api/dictionary/[id]/db
 *
 * Fresh full snapshot of `dictionaries/{id}.db` for editors (Story B.2).
 *
 * - Requires editor+ role (or admin bypass).
 * - Uses `db.backup()` (page-by-page copy under SHARED lock, safe under WAL).
 * - Gzips on the fly and streams back.
 *
 * Viewers use the R2 path (`snapshots.livingdictionaries.app/dictionaries/{id}.db.gz`)
 * instead — that's a public bucket, no auth.
 */
export const GET: RequestHandler = async (event) => {
  const dict_id = event.params.id
  if (!dict_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing dictionary id')

  await verify_auth_dict_role(event, dict_id, 'editor')

  const dict_db = get_dictionary_db(dict_id)

  // Stream-safe approach: write to temp file via `db.backup()`, gzip, send,
  // delete. better-sqlite3's backup returns a promise.
  const temp_path = join(tmpdir(), `dict-snapshot-${dict_id}-${crypto.randomUUID()}.db`)
  try {
    await dict_db.backup(temp_path)
    if (!existsSync(temp_path))
      error(ResponseCodes.INTERNAL_SERVER_ERROR, 'Snapshot file missing after backup')

    const bytes = readFileSync(temp_path)
    const gzipped = gzipSync(bytes)
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
