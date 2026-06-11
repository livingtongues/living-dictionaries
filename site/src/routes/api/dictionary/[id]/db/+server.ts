import type { RequestHandler } from './$types'
import Database from 'better-sqlite3'
import { gzipSync } from 'node:zlib'
import { unlink } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { verify_auth_dict_role } from '$lib/auth/verify-dict-role'
import { ResponseCodes } from '$lib/constants'
import { get_dictionary_by_url_or_id } from '$lib/db/server/get-dictionary'
import { get_dictionary_db } from '$lib/db/server/dictionary-db'
import { error } from '@sveltejs/kit'

/**
 * GET /api/dictionary/[id]/db
 *
 * Fresh full snapshot of `dictionaries/{id}.db` for editors — the wa-sqlite
 * bootstrap fast-path (the browser writes these bytes into OPFS, then opens with
 * the OPFS VFS, then syncs deltas via `/changes`).
 *
 * Editor+ only (site admins bypass). Viewers fetch the public R2 path instead
 * (`snapshots.livingdictionaries.app/dictionaries/{id}.db.gz`) — a public,
 * CDN-cached bucket rebuilt by the in-process r2-snapshot-builder cron.
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

  await verify_auth_dict_role(event, dictionary.id, 'editor')

  const dict_db = get_dictionary_db(dictionary.id)

  const temp_path = join(tmpdir(), `dict-snapshot-${dictionary.id}-${crypto.randomUUID()}.db`)
  try {
    await dict_db.backup(temp_path)
    if (!existsSync(temp_path))
      error(ResponseCodes.INTERNAL_SERVER_ERROR, 'Snapshot file missing after backup')

    // `backup()` preserves the source's WAL-mode header (writer/read version 2);
    // the browser's single-file OPFS sync-access-handle VFS can only open a
    // rollback-journal file (version 1). Flip it to DELETE so the bytes are
    // OPFS-openable (else the client falls back to MemoryVFS + re-downloads).
    const temp_db = new Database(temp_path)
    try {
      temp_db.pragma('journal_mode = DELETE')
    } finally {
      temp_db.close()
    }

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
