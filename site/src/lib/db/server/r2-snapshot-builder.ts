import Database from 'better-sqlite3'
import { existsSync, readFileSync } from 'node:fs'
import { unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { r2_dict_snapshot_key, R2_SNAPSHOT_INTERVAL_MS, SNAPSHOT_EXPIRED_DAYS } from '$lib/constants'
import { get_r2_snapshot_client } from '$lib/r2/snapshot-client'
import { get_dictionary_db } from './dictionary-db'
import { get_shared_db } from './shared-db'

/**
 * Per-dictionary snapshot builder cron.
 *
 * Every `R2_SNAPSHOT_INTERVAL_MS`:
 *   1. Query `dictionaries WHERE updated_at > COALESCE(snapshot_uploaded_at, '1970')`
 *   2. For each: `db.backup()` → gzip → R2 PutObject to fixed key
 *      `dictionaries/{id}.db.gz` (Cache-Control: max-age=120).
 *   3. `UPDATE dictionaries SET snapshot_uploaded_at = <build_ts> WHERE id = ?`
 *
 * `R2_SNAPSHOT_BUILDER_ENABLED` env var gates this from hooks.server.ts; this
 * module exports `start_r2_snapshot_builder()` for hooks to call.
 *
 * Singleton via globalThis guard (tutor's `start_worker_once` pattern) so
 * dev-server HMR doesn't accidentally double-start.
 */

const SINGLETON_KEY = Symbol.for('living-dictionaries:r2-snapshot-builder')

interface BuilderState {
  interval: ReturnType<typeof setInterval>
  in_flight: boolean
}

interface GlobalWithBuilder {
  [SINGLETON_KEY]?: BuilderState
}

export function start_r2_snapshot_builder() {
  const slot = globalThis as unknown as GlobalWithBuilder
  if (slot[SINGLETON_KEY]) {
    console.info('[r2-snapshot-builder] Already running — skip.')
    return
  }

  const state: BuilderState = {
    interval: setInterval(() => void run_once(state), R2_SNAPSHOT_INTERVAL_MS),
    in_flight: false,
  }
  slot[SINGLETON_KEY] = state
  // Kick off an immediate first pass so we don't wait 30 min after boot.
  void run_once(state)
  console.info(`[r2-snapshot-builder] Started — sweeping every ${R2_SNAPSHOT_INTERVAL_MS / 60_000} min.`)
}

export function stop_r2_snapshot_builder() {
  const slot = globalThis as unknown as GlobalWithBuilder
  const state = slot[SINGLETON_KEY]
  if (!state)
    return
  clearInterval(state.interval)
  delete slot[SINGLETON_KEY]
}

async function run_once(state: BuilderState) {
  if (state.in_flight)
    return
  state.in_flight = true
  try {
    await sweep_dirty_dictionaries()
  } catch (err) {
    console.error('[r2-snapshot-builder] sweep failed:', err)
  } finally {
    state.in_flight = false
  }
}

export async function sweep_dirty_dictionaries() {
  const shared = get_shared_db()
  const rows = shared.prepare(
    `SELECT id FROM dictionaries
     WHERE updated_at > COALESCE(snapshot_uploaded_at, '1970-01-01T00:00:00.000Z')
     ORDER BY updated_at ASC`,
  ).all() as { id: string }[]

  if (rows.length === 0)
    return { uploaded: 0 }

  console.info(`[r2-snapshot-builder] ${rows.length} dictionary/dictionaries need fresh snapshots.`)
  let uploaded = 0
  for (const { id } of rows) {
    try {
      const build_ts = new Date().toISOString()
      await build_and_upload_snapshot(id)
      shared.prepare(`UPDATE dictionaries SET snapshot_uploaded_at = ? WHERE id = ?`).run(build_ts, id)
      uploaded++
    } catch (err) {
      console.error(`[r2-snapshot-builder] Failed for ${id}:`, err)
    }
  }
  console.info(`[r2-snapshot-builder] Uploaded ${uploaded}/${rows.length} snapshots.`)
  return { uploaded }
}

export async function build_and_upload_snapshot(dict_id: string) {
  const dict_db = get_dictionary_db(dict_id)

  // Prune tombstones older than the snapshot-expiry window from the SOURCE db.
  // A client whose cursor predates them gets 410 `snapshot_expired` (full
  // refetch) anyway, so they can never be needed for a pull again — without
  // pruning, the deletes log grows forever. (DELETE on `deletes` is inert:
  // the cascade trigger is AFTER INSERT only, and no lmod trigger watches it.)
  const cutoff = new Date(Date.now() - SNAPSHOT_EXPIRED_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const source_has_deletes = dict_db.prepare(
    `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'deletes'`,
  ).get()
  if (source_has_deletes)
    dict_db.prepare(`DELETE FROM deletes WHERE updated_at < ?`).run(cutoff)

  const temp_path = join(tmpdir(), `snapshot-${dict_id}-${crypto.randomUUID()}.db`)
  try {
    await dict_db.backup(temp_path)
    if (!existsSync(temp_path))
      throw new Error(`backup() did not produce ${temp_path}`)

    // Strip the durable tombstone log from the snapshot. The deleted rows are
    // already absent (server hard-deleted them), so the tombstones carry no
    // info a fresh client needs — and leaving them in would make the client
    // re-push the server's ENTIRE delete history on its first sync (the client
    // `deletes` table doubles as its push queue).
    const temp_db = new Database(temp_path)
    try {
      const has_deletes = temp_db.prepare(
        `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'deletes'`,
      ).get()
      if (has_deletes)
        temp_db.exec('DELETE FROM deletes')

      // `backup()` preserves the source's WAL-mode header (writer/read version 2);
      // the browser's single-file OPFS sync-access-handle VFS can only open a
      // rollback-journal file (version 1). Flip it to DELETE so the header is
      // OPFS-openable — without this, every client falls back to MemoryVFS and
      // re-downloads every boot.
      temp_db.pragma('journal_mode = DELETE')
    } finally {
      temp_db.close()
    }

    const bytes = readFileSync(temp_path)
    const gzipped = gzipSync(bytes)
    await upload_to_r2({ key: r2_dict_snapshot_key(dict_id), bytes: gzipped })
  } finally {
    try { await unlink(temp_path) } catch { /* best-effort */ }
  }
}

async function upload_to_r2({ key, bytes }: { key: string, bytes: Uint8Array }) {
  const { client, bucket } = get_r2_snapshot_client()
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: bytes,
    ContentType: 'application/octet-stream',
    ContentEncoding: 'gzip',
    CacheControl: 'public, max-age=120',
  }))
}

/** Build one snapshot ad-hoc (e.g. a cutover-day backfill or an admin force-rebuild). */
export async function force_rebuild_snapshot(dict_id: string): Promise<void> {
  await build_and_upload_snapshot(dict_id)
  const shared: Database.Database = get_shared_db()
  shared.prepare(`UPDATE dictionaries SET snapshot_uploaded_at = ? WHERE id = ?`).run(new Date().toISOString(), dict_id)
}
