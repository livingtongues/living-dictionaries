import Database from 'better-sqlite3'
import { existsSync } from 'node:fs'
import { readFile, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { gzip } from 'node:zlib'
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { env } from '$env/dynamic/private'
import { r2_dict_snapshot_key, SNAPSHOT_EXPIRED_DAYS } from '$lib/constants'
import { DICT_SYNCABLE_TABLES } from '$lib/db/dict-syncable-tables'
import { get_r2_snapshot_client } from '$lib/r2/snapshot-client'
import { log_server_event } from '$lib/server/log-server-event'
import { get_dictionary_db } from './dictionary-db'
import { reconcile_dictionary_catalog } from './reconcile-dictionaries'
import { get_shared_db } from './shared-db'

/**
 * Per-dictionary snapshot builder cron.
 *
 * WATERMARK VOCABULARY — the `dictionaries.updated_at` this reads is the
 * **catalog_updated_at_mirror** (written by `v1-route-context.ts`
 * `mirror_dictionary_cursor` from a per-dict `dict_content_cursor`), NOT an
 * admin/browser sync cursor. `snapshot_uploaded_at` is this builder's own
 * per-dict high-water mark; a dict re-snapshots whenever the mirror runs ahead
 * of it.
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

/**
 * Compression on the libuv THREAD POOL, never on the event loop.
 *
 * MEASURED (parity review 2026-08-01, replaying two live dictionary files):
 * `gzipSync` of the 54 MB `sora-language-project` db froze this process for
 * **792 ms** (831 ms of unbroken freeze with the surrounding `readFileSync`),
 * during which no request is parsed, no response written and no health check
 * answered. The same build with `promisify(gzip)` + `readFile`: worst observed
 * stall **42 ms**, total wall-clock essentially unchanged (986 → 1,089 ms). The
 * work still costs the same; it just stops being exclusive.
 *
 * Both snapshot builders — this cron and the editor-boot `/api/dictionary/[id]/db`
 * endpoint, which runs ON the request thread — use the async pair. Never
 * reintroduce a `*Sync` here.
 */
const gzip_async = promisify(gzip)

/**
 * Above this the sweep gets a `warn` instead of an `info`. The builder shares the
 * serving process, and its synchronous SQLite work (`strip_and_bake`) is an
 * event-loop freeze while it runs — on 2026-08-02 the new `loop_lag_max_ms` meter
 * caught **6.4 s** at 03:03 UTC plus shorter spells at 07:33 and 14:03, and this
 * job could only be *inferred* as the cause from an `:03`/`:33` timestamp because
 * it emitted no telemetry at all (zero `log_server_event` calls). §1.2 of
 * `.cron/log-reviews/2026-08-02.md`.
 */
const SNAPSHOT_SWEEP_WARN_MS = 2_000

/** What one sweep reports about itself. `step_ms` is where the time actually went. */
interface SnapshotSweepSummary {
  dictionaries: number
  bytes_uploaded: number
  duration_ms: number
  step_ms: Record<string, number>
  /**
   * Sum of the steps that run SYNCHRONOUSLY on the event loop — the number that
   * maps to an event-loop stall. The rest (`backup`, `read_file`, `gzip`,
   * `upload`) is async/threadpool/network and costs wall clock, not the loop.
   */
  blocking_ms: number
  slowest_dict: { id: string, ms: number } | null
}

/** The roster's `disabled_reason`: only the designated builder node runs this. */
export function r2_snapshot_disabled_reason(): string | null {
  return env.R2_SNAPSHOT_BUILDER_ENABLED === 'true' ? null : 'R2_SNAPSHOT_BUILDER_ENABLED is not "true"'
}

/**
 * One-shot catalog-drift heal, run before the FIRST sweep of this process:
 * recount `entry_count` and bump `updated_at` for any dict whose live cursor
 * ran ahead of the catalog mirror (a metadata-only write like the
 * featured-stars sweep). That flags them dirty so the first pass re-snapshots
 * them — otherwise fresh viewers keep tripping snapshot_expired.
 */
let reconciled_this_process = false
function reconcile_once_per_process(): void {
  if (reconciled_this_process)
    return
  reconciled_this_process = true
  try {
    const result = reconcile_dictionary_catalog({})
    if (result.entry_count_fixed || result.cursor_bumped)
      console.info(`[r2-snapshot-builder] reconcile: ${result.entry_count_fixed} entry_count fixed, ${result.cursor_bumped} cursors bumped (of ${result.checked}).`)
  } catch (err) {
    console.error('[r2-snapshot-builder] reconcile failed:', err)
  }
}

/**
 * The roster's `run`: heal catalog drift (first pass only), then snapshot every
 * dirty dictionary — and TELL US WHAT IT COST.
 *
 * A quiet sweep (nothing dirty, nothing deleted, fast) stays silent: this fires
 * every 30 minutes and an empty pass would add 48 rows/day to a 2 GB logs.db for
 * no information. Anything that did work, took longer than
 * `SNAPSHOT_SWEEP_WARN_MS`, or failed always reports.
 */
export async function run_r2_snapshot_sweep(): Promise<void> {
  const started = performance.now()
  const step_ms: Record<string, number> = {}
  const reconcile_started = performance.now()
  reconcile_once_per_process()
  const reconcile_ms = Math.round(performance.now() - reconcile_started)
  if (reconcile_ms > 0)
    step_ms.reconcile = reconcile_ms
  try {
    const result = await sweep_dirty_dictionaries({ step_ms })
    const summary: SnapshotSweepSummary = {
      dictionaries: result.uploaded,
      bytes_uploaded: result.bytes_uploaded,
      duration_ms: Math.round(performance.now() - started),
      step_ms,
      blocking_ms: (step_ms.reconcile ?? 0) + (step_ms.prune_deletes ?? 0) + (step_ms.strip_and_bake ?? 0) + (step_ms.list_dirty ?? 0),
      slowest_dict: result.slowest_dict,
    }
    const did_work = result.uploaded > 0 || result.deleted > 0
    if (did_work || summary.duration_ms > SNAPSHOT_SWEEP_WARN_MS) {
      log_server_event({
        level: summary.duration_ms > SNAPSHOT_SWEEP_WARN_MS ? 'warn' : 'info',
        message: 'snapshot_sweep_completed',
        context: { ...summary, deleted: result.deleted, failed: result.failed },
      })
    }
  } catch (err) {
    console.error('[r2-snapshot-builder] sweep failed:', err)
    log_server_event({
      level: 'error',
      message: 'snapshot_sweep_failed',
      error: err,
      context: { duration_ms: Math.round(performance.now() - started), step_ms },
    })
  }
}

export async function sweep_dirty_dictionaries({ step_ms = {} }: { step_ms?: Record<string, number> } = {}) {
  const shared = get_shared_db()

  // Secure dictionaries (`bucket = 'secure'`) must never have a snapshot in the
  // PUBLIC R2 bucket — members boot via the authed `/api/dictionary/[id]/db`
  // path instead. Self-healing: any secure dict that still has one uploaded
  // (e.g. it was flipped secure after a snapshot existed) gets its R2 object
  // deleted and its watermark cleared.
  const secure_with_snapshot = shared.prepare(
    `SELECT id FROM dictionaries WHERE bucket = 'secure' AND snapshot_uploaded_at IS NOT NULL`,
  ).all() as { id: string }[]
  let deleted = 0
  for (const { id } of secure_with_snapshot) {
    try {
      await delete_from_r2({ key: r2_dict_snapshot_key(id) })
      shared.prepare(`UPDATE dictionaries SET snapshot_uploaded_at = NULL WHERE id = ?`).run(id)
      deleted++
      console.info(`[r2-snapshot-builder] Deleted public snapshot of secure dictionary ${id}.`)
    } catch (err) {
      console.error(`[r2-snapshot-builder] Failed to delete secure snapshot for ${id}:`, err)
    }
  }

  const list_started = performance.now()
  const rows = shared.prepare(
    `SELECT id FROM dictionaries
     WHERE updated_at > COALESCE(snapshot_uploaded_at, '1970-01-01T00:00:00.000Z')
       AND (bucket IS NULL OR bucket != 'secure')
     ORDER BY updated_at ASC`,
  ).all() as { id: string }[]
  add_step({ step_ms, label: 'list_dirty', started: list_started })

  if (rows.length === 0)
    return { uploaded: 0, deleted, failed: 0, bytes_uploaded: 0, slowest_dict: null }

  console.info(`[r2-snapshot-builder] ${rows.length} dictionary/dictionaries need fresh snapshots.`)
  let uploaded = 0
  let failed = 0
  let bytes_uploaded = 0
  let slowest_dict: { id: string, ms: number } | null = null
  for (const { id } of rows) {
    try {
      const build_ts = new Date().toISOString()
      const built = await build_and_upload_snapshot(id, { step_ms })
      shared.prepare(`UPDATE dictionaries SET snapshot_uploaded_at = ? WHERE id = ?`).run(build_ts, id)
      uploaded++
      bytes_uploaded += built.bytes_uploaded
      if (!slowest_dict || built.duration_ms > slowest_dict.ms)
        slowest_dict = { id, ms: built.duration_ms }
    } catch (err) {
      failed++
      console.error(`[r2-snapshot-builder] Failed for ${id}:`, err)
    }
  }
  console.info(`[r2-snapshot-builder] Uploaded ${uploaded}/${rows.length} snapshots.`)
  return { uploaded, deleted, failed, bytes_uploaded, slowest_dict }
}

/** Accumulate one step's wall clock under `label` (summed across dictionaries). */
function add_step({ step_ms, label, started }: { step_ms: Record<string, number>, label: string, started: number }): void {
  step_ms[label] = Math.round((step_ms[label] ?? 0) + performance.now() - started)
}

export async function build_and_upload_snapshot(dict_id: string, { step_ms = {} }: { step_ms?: Record<string, number> } = {}) {
  const dict_started = performance.now()
  const dict_db = get_dictionary_db(dict_id)
  const prune_started = performance.now()

  // Prune tombstones older than the snapshot-expiry window from the SOURCE db.
  // A client whose cursor predates them gets 410 `snapshot_expired` (full
  // refetch) anyway, so they can never be needed for a pull again — without
  // pruning, the deletes log grows forever. (DELETE on `deletes` is inert:
  // the cascade trigger is AFTER INSERT only, and no lmod trigger watches it.)
  // Record the highest pruned seq in `db_metadata.pruned_up_to_seq` FIRST —
  // that's what the /changes endpoint compares cursors against to 410
  // `snapshot_expired` (cursors are server_seq values, not timestamps).
  const cutoff = new Date(Date.now() - SNAPSHOT_EXPIRED_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const source_has_deletes = dict_db.prepare(
    `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'deletes'`,
  ).get()
  if (source_has_deletes) {
    // Only on a migrated source (counter table present ⇒ deletes.server_seq +
    // db_metadata exist too) — tolerate a pre-20260709 file.
    const source_has_counter = dict_db.prepare(
      `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'server_seq_counter'`,
    ).get()
    if (source_has_counter) {
      const pruned = dict_db.prepare(`SELECT MAX(server_seq) AS max_seq FROM deletes WHERE updated_at < ?`).get(cutoff) as { max_seq: number | null }
      if (pruned.max_seq !== null) {
        dict_db.prepare(
          `INSERT INTO db_metadata (key, value) VALUES ('pruned_up_to_seq', ?)
           ON CONFLICT(key) DO UPDATE SET value = MAX(CAST(value AS INTEGER), CAST(excluded.value AS INTEGER))`,
        ).run(String(pruned.max_seq))
      }
    }
    dict_db.prepare(`DELETE FROM deletes WHERE updated_at < ?`).run(cutoff)
  }
  add_step({ step_ms, label: 'prune_deletes', started: prune_started })

  const temp_path = join(tmpdir(), `snapshot-${dict_id}-${crypto.randomUUID()}.db`)
  try {
    const backup_started = performance.now()
    await dict_db.backup(temp_path)
    add_step({ step_ms, label: 'backup', started: backup_started })
    if (!existsSync(temp_path))
      throw new Error(`backup() did not produce ${temp_path}`)

    const strip_started = performance.now()

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

      // Nobody boots a snapshot already holding "unsaved work". `dirty` is a
      // client-only flag; a canonical row carrying it is inherited by every
      // visitor and can never be cleared by a viewer (pull-only clients don't
      // push), so the tab warns `dirty_rows_stuck` forever. Cleared in the COPY,
      // never in the live dictionary db. (2026-07-26: 5,437 such rows across 33
      // dictionaries.)
      const dirty_cleared = clear_dirty_flags(temp_db)
      if (dirty_cleared)
        console.info(`[r2-snapshot-builder] ${dict_id}: cleared ${dirty_cleared} inherited dirty flag(s) from the snapshot.`)

      // Bake the snapshot's own sync cursor into it: everything in this file has
      // server_seq ≤ the counter, so a client booting from it starts pulling from
      // exactly here (`db_metadata.synced_seq` is the key the engine reads).
      bake_synced_seq(temp_db)

      // `backup()` preserves the source's WAL-mode header (writer/read version 2);
      // the browser's single-file OPFS sync-access-handle VFS can only open a
      // rollback-journal file (version 1). Flip it to DELETE so the header is
      // OPFS-openable — without this, every client falls back to MemoryVFS and
      // re-downloads every boot.
      temp_db.pragma('journal_mode = DELETE')
    } finally {
      temp_db.close()
      // The whole `temp_db` block is SYNCHRONOUS better-sqlite3 work on the serving
      // process's event loop — the freeze candidate, and the reason this step is
      // measured separately from the async backup/read/gzip/upload around it.
      add_step({ step_ms, label: 'strip_and_bake', started: strip_started })
    }

    const read_started = performance.now()
    const bytes = await readFile(temp_path)
    add_step({ step_ms, label: 'read_file', started: read_started })
    const gzip_started = performance.now()
    const gzipped = await gzip_async(bytes)
    add_step({ step_ms, label: 'gzip', started: gzip_started })
    const upload_started = performance.now()
    await upload_to_r2({ key: r2_dict_snapshot_key(dict_id), bytes: gzipped })
    add_step({ step_ms, label: 'upload', started: upload_started })
    return { bytes_uploaded: gzipped.byteLength, duration_ms: Math.round(performance.now() - dict_started) }
  } finally {
    try { await unlink(temp_path) } catch { /* best-effort */ }
  }
}

/**
 * Write the counter's current value into a SNAPSHOT COPY's
 * `db_metadata.synced_seq` so booting clients know their pull cursor. Exported
 * for the editor `/db` endpoint, which builds its snapshot the same way.
 * Tolerates a pre-20260709 source (no counter table) by skipping.
 */
/**
 * Clear every `dirty` flag in a SNAPSHOT copy (never the live dictionary db).
 *
 * `dirty` says "this browser holds an unsynced local edit" — it is meaningless
 * on a canonical row, and a viewer inheriting one can never clear it (pull-only
 * clients don't push), so their tab believes it has unsaved work forever. Also
 * self-heals dictionaries whose rows were flagged by pre-2026-07-27 server
 * writes: the first re-snapshot ships them clean.
 *
 * Returns the number of rows cleared (logged so the one-time drain is visible).
 */
export function clear_dirty_flags(snapshot_db: Database.Database): number {
  let cleared = 0
  for (const table of DICT_SYNCABLE_TABLES) {
    const columns = snapshot_db.pragma(`table_info("${table}")`) as { name: string }[]
    // Tolerates a table that doesn't exist (empty pragma) or predates the column.
    if (!columns.some(column => column.name === 'dirty'))
      continue
    cleared += snapshot_db.prepare(`UPDATE "${table}" SET dirty = NULL WHERE dirty IS NOT NULL`).run().changes
  }
  return cleared
}

export function bake_synced_seq(snapshot_db: Database.Database): void {
  const has_counter = snapshot_db.prepare(
    `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'server_seq_counter'`,
  ).get()
  if (!has_counter)
    return
  const counter = snapshot_db.prepare(`SELECT seq FROM server_seq_counter`).get() as { seq: number } | undefined
  snapshot_db.prepare(
    `INSERT INTO db_metadata (key, value) VALUES ('synced_seq', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(String(counter?.seq ?? 0))
}

/**
 * The body is gzip bytes uploaded as an OPAQUE blob — deliberately NO
 * `ContentEncoding: 'gzip'`. On house's zone, Cloudflare transparently
 * DECOMPRESSED a `Content-Encoding: gzip` R2 object at the edge and served
 * every cold reader ~2.4× the bytes; LD's zone happened to pass it through,
 * but that's zone config we don't want to depend on. An opaque blob can't be
 * transformed; the client inflates by magic-byte sniff (`fetch-snapshot.ts`).
 */
async function upload_to_r2({ key, bytes }: { key: string, bytes: Uint8Array }) {
  const { client, bucket } = get_r2_snapshot_client()
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: bytes,
    ContentType: 'application/octet-stream',
    CacheControl: 'public, max-age=120',
  }))
}

async function delete_from_r2({ key }: { key: string }) {
  const { client, bucket } = get_r2_snapshot_client()
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}

/** Build one snapshot ad-hoc (e.g. a cutover-day backfill or an admin force-rebuild). */
export async function force_rebuild_snapshot(dict_id: string): Promise<void> {
  const shared_db: Database.Database = get_shared_db()
  const row = shared_db.prepare(`SELECT bucket FROM dictionaries WHERE id = ?`).get(dict_id) as { bucket: string | null } | undefined
  if (row?.bucket === 'secure')
    throw new Error(`Refusing to upload a PUBLIC snapshot of secure dictionary ${dict_id}`)
  await build_and_upload_snapshot(dict_id)
  const shared: Database.Database = get_shared_db()
  shared.prepare(`UPDATE dictionaries SET snapshot_uploaded_at = ? WHERE id = ?`).run(new Date().toISOString(), dict_id)
}
