import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import Database from 'better-sqlite3'
import { building, dev } from '$app/environment'
import { env } from '$env/dynamic/private'
import { get_r2_media, r2_media_is_configured } from '$lib/server/r2-media'
import { generate_and_store_photo_variants } from '$lib/server/photo-variants'
import { log_server_event } from '$lib/server/log-server-event'
import { photo_variant_key, PHOTO_VARIANTS } from '$lib/utils/media-path'
import { dictionary_db_path } from './dictionary-db'
import { parse_media_key } from './media-ledger'
import { get_shared_db } from './shared-db'

/**
 * Media storage sweep (decisions Jacob 2026-07-23) — ONE job that:
 *  1. DAILY: rolls the `media_objects` ledger up into `media_storage_daily`
 *     (the /admin/storage trend source — never lists R2 for a page view).
 *  2. WEEKLY: reconciles the ledger against a full R2 listing (true-up sizes,
 *     adopt unknown keys, drop ledger rows whose object vanished / whose
 *     presigned PUT never happened), marks objects no live row references as
 *     orphaned, REALLY deletes orphans past the ~30-day grace (safe: the
 *     locked `livingdictionaries-backups/media/` mirror retains 1 year), and
 *     self-heals photo originals missing WebP variants (the crash gap of the
 *     respond-then-generate upload flow).
 *
 * Live references = dict.db audio/videos/photos storage_paths (+ derived photo
 * variant keys) + shared.db partner logos + dictionaries.featured_image. Only
 * new-convention keys participate; legacy GCS paths are ignored entirely.
 */

const TICK_MS = 60 * 60 * 1000 // hourly tick; the day/week gates below decide the real work
const RECONCILE_EVERY_MS = 6.5 * 24 * 60 * 60 * 1000
const ORPHAN_GRACE_MS = 30 * 24 * 60 * 60 * 1000
/** Presign-seeded ledger rows younger than this may simply not have finished uploading. */
const ABANDONED_PRESIGN_GRACE_MS = 60 * 60 * 1000
const DELETE_CAP_PER_RUN = 5000
const VARIANT_HEAL_CAP_PER_RUN = 200
const RECONCILE_WATERMARK_KEY = 'media_sweep_last_reconcile'

export function run_media_rollup_once(): void {
  const db = get_shared_db()
  const today = new Date().toISOString().slice(0, 10)
  const exists = db.prepare(`SELECT 1 FROM media_storage_daily WHERE date = ? LIMIT 1`).get(today)
  if (exists)
    return
  db.prepare(`
    INSERT OR REPLACE INTO media_storage_daily (date, dict_id, media_type, bytes, object_count)
    SELECT ?, dict_id, media_type, SUM(bytes), COUNT(*) FROM media_objects GROUP BY dict_id, media_type
  `).run(today)
}

async function list_media_bucket(): Promise<Map<string, { bytes: number, last_modified: string }>> {
  const { client, bucket } = get_r2_media()
  const keys = new Map<string, { bytes: number, last_modified: string }>()
  let token: string | undefined
  do {
    const result = await client.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }))
    for (const object of result.Contents ?? [])
      keys.set(object.Key, { bytes: object.Size, last_modified: object.LastModified?.toISOString() ?? new Date().toISOString() })
    token = result.IsTruncated ? result.NextContinuationToken : undefined
  } while (token)
  return keys
}

/** Every new-convention key a dict's live rows reference (incl. derived photo variant keys). */
function live_keys_for_dict(dict_id: string): Set<string> {
  const keys = new Set<string>()
  const add = (path: string | null | undefined) => {
    if (!path || !parse_media_key(path))
      return
    keys.add(path)
    if (parse_media_key(path).media_type === 'photo') {
      for (const variant of PHOTO_VARIANTS)
        keys.add(photo_variant_key({ original_key: path, variant }))
    }
  }
  try {
    const db = new Database(dictionary_db_path(dict_id), { readonly: true })
    try {
      for (const table of ['audio', 'videos', 'photos']) {
        const has = db.prepare(`SELECT 1 FROM sqlite_master WHERE name = ?`).get(table)
        if (!has)
          continue
        for (const row of db.prepare(`SELECT storage_path FROM ${table} WHERE storage_path IS NOT NULL`).all() as { storage_path: string }[])
          add(row.storage_path)
      }
    } finally {
      db.close()
    }
  } catch {
    // dict.db unreadable/missing (deleted dict) — nothing is live; orphan grace still applies
  }
  const shared = get_shared_db()
  for (const row of shared.prepare(`SELECT photo_storage_path FROM dictionary_partners WHERE dictionary_id = ? AND photo_storage_path IS NOT NULL`).all(dict_id) as { photo_storage_path: string }[])
    add(row.photo_storage_path)
  const dict_row = shared.prepare(`SELECT featured_image FROM dictionaries WHERE id = ?`).get(dict_id) as { featured_image: string | null } | undefined
  if (dict_row?.featured_image) {
    try {
      add(JSON.parse(dict_row.featured_image)?.storage_path)
    } catch { /* malformed legacy JSON */ }
  }
  return keys
}

export interface MediaReconcileSummary {
  listed: number
  adopted: number
  size_fixed: number
  ledger_rows_dropped: number
  newly_orphaned: number
  unorphaned: number
  deleted: number
  variants_healed: number
  variant_heal_failures: number
}

export async function run_media_reconcile_once(): Promise<MediaReconcileSummary> {
  const db = get_shared_db()
  const { client, bucket } = get_r2_media()
  const now = Date.now()
  const now_iso = new Date(now).toISOString()
  const summary: MediaReconcileSummary = { listed: 0, adopted: 0, size_fixed: 0, ledger_rows_dropped: 0, newly_orphaned: 0, unorphaned: 0, deleted: 0, variants_healed: 0, variant_heal_failures: 0 }

  const remote = await list_media_bucket()
  summary.listed = remote.size

  // 1. Ledger true-up against the listing.
  const ledger_rows = db.prepare(`SELECT key, bytes, uploaded_at FROM media_objects`).all() as { key: string, bytes: number, uploaded_at: string }[]
  const ledger_by_key = new Map(ledger_rows.map(row => [row.key, row]))
  const adopt = db.prepare(`INSERT OR IGNORE INTO media_objects (key, dict_id, media_type, is_variant, bytes, uploaded_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
  const fix_size = db.prepare(`UPDATE media_objects SET bytes = ?, last_seen_at = ? WHERE key = ?`)
  const touch = db.prepare(`UPDATE media_objects SET last_seen_at = ? WHERE key = ?`)
  const drop_row = db.prepare(`DELETE FROM media_objects WHERE key = ?`)
  db.transaction(() => {
    for (const [key, object] of remote) {
      if (!ledger_by_key.has(key)) {
        const parsed = parse_media_key(key)
        if (!parsed)
          continue // foreign key shape in the bucket — not ours to manage
        adopt.run(key, parsed.dict_id, parsed.media_type, parsed.is_variant ? 1 : 0, object.bytes, object.last_modified, now_iso)
        summary.adopted++
        continue
      }
      const row = ledger_by_key.get(key)
      if (row && row.bytes !== object.bytes) {
        fix_size.run(object.bytes, now_iso, key)
        summary.size_fixed++
      } else {
        touch.run(now_iso, key)
      }
    }
    for (const row of ledger_rows) {
      if (remote.has(row.key))
        continue
      // Not in R2: abandoned presign seed (never uploaded) or an externally-deleted
      // object — either way the ledger row is stale. Grace for in-flight uploads.
      if (now - Date.parse(row.uploaded_at) > ABANDONED_PRESIGN_GRACE_MS) {
        drop_row.run(row.key)
        summary.ledger_rows_dropped++
      }
    }
  })()

  // 2. Orphan marking per dict (live rows vs ledger).
  const dict_ids = (db.prepare(`SELECT DISTINCT dict_id FROM media_objects`).all() as { dict_id: string }[]).map(row => row.dict_id)
  const mark_orphan = db.prepare(`UPDATE media_objects SET orphaned_at = ? WHERE key = ? AND orphaned_at IS NULL`)
  const clear_orphan = db.prepare(`UPDATE media_objects SET orphaned_at = NULL WHERE key = ? AND orphaned_at IS NOT NULL`)
  for (const dict_id of dict_ids) {
    const live = live_keys_for_dict(dict_id)
    const rows = db.prepare(`SELECT key, orphaned_at FROM media_objects WHERE dict_id = ?`).all(dict_id) as { key: string, orphaned_at: string | null }[]
    db.transaction(() => {
      for (const row of rows) {
        if (live.has(row.key)) {
          if (row.orphaned_at) {
            clear_orphan.run(row.key)
            summary.unorphaned++
          }
        } else if (!row.orphaned_at) {
          mark_orphan.run(now_iso, row.key)
          summary.newly_orphaned++
        }
      }
    })()
  }

  // 3. REAL deletion of orphans past grace (capped per run).
  const expired = db.prepare(`SELECT key FROM media_objects WHERE orphaned_at IS NOT NULL AND orphaned_at < ? LIMIT ?`)
    .all(new Date(now - ORPHAN_GRACE_MS).toISOString(), DELETE_CAP_PER_RUN) as { key: string }[]
  for (let start = 0; start < expired.length; start += 1000) {
    const batch = expired.slice(start, start + 1000)
    await client.send(new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: batch.map(row => ({ Key: row.key })), Quiet: true },
    }))
    db.transaction(() => {
      for (const row of batch)
        drop_row.run(row.key)
    })()
    summary.deleted += batch.length
  }

  // 4. Self-heal photo originals missing variants (upload crash gap).
  const missing_variant_originals: string[] = []
  for (const [key] of remote) {
    const parsed = parse_media_key(key)
    if (!parsed || parsed.media_type !== 'photo' || parsed.is_variant)
      continue
    if (PHOTO_VARIANTS.some(variant => !remote.has(photo_variant_key({ original_key: key, variant }))))
      missing_variant_originals.push(key)
  }
  for (const key of missing_variant_originals.slice(0, VARIANT_HEAL_CAP_PER_RUN)) {
    try {
      const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
      const bytes = new Uint8Array(await object.Body.transformToByteArray())
      await generate_and_store_photo_variants({ original_key: key, bytes })
      summary.variants_healed++
    } catch (err) {
      summary.variant_heal_failures++
      console.error(`[media-sweep] variant heal failed for ${key}: ${err.message}`)
    }
  }

  db.prepare(`INSERT INTO db_metadata (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value`)
    .run(RECONCILE_WATERMARK_KEY, now_iso)
  return summary
}

const SINGLETON_KEY = Symbol.for('living.media-sweep-cron.state')
interface CronState { interval: ReturnType<typeof setInterval>, in_flight: boolean }
interface GlobalWithCron { [SINGLETON_KEY]?: CronState }

export function start_media_sweep_cron_once(): void {
  if (building || dev)
    return
  if (env.IS_STANDBY === 'true') {
    console.info('[media-sweep] IS_STANDBY — cron disabled on standby container.')
    return
  }
  if (!r2_media_is_configured()) {
    console.info('[media-sweep] R2 media creds absent — cron disabled.')
    return
  }
  const slot = globalThis as unknown as GlobalWithCron
  if (slot[SINGLETON_KEY])
    return
  const state: CronState = {
    interval: setInterval(() => void run_guarded(state), TICK_MS).unref(),
    in_flight: false,
  }
  slot[SINGLETON_KEY] = state
  void run_guarded(state)
  console.info('[media-sweep] Started — daily ledger rollup, weekly R2 reconcile + orphan cleanup.')
}

async function run_guarded(state: CronState): Promise<void> {
  if (state.in_flight)
    return
  state.in_flight = true
  try {
    run_media_rollup_once()
    const db = get_shared_db()
    const watermark = db.prepare(`SELECT value FROM db_metadata WHERE key = ?`).get(RECONCILE_WATERMARK_KEY) as { value: string } | undefined
    const due = !watermark || Date.now() - Date.parse(watermark.value) > RECONCILE_EVERY_MS
    if (due) {
      const summary = await run_media_reconcile_once()
      console.info(`[media-sweep] reconcile: ${JSON.stringify(summary)}`)
      log_server_event({ level: 'info', message: 'media_sweep_reconciled', context: { ...summary } })
    }
  } catch (err) {
    console.error('[media-sweep] failed:', err)
    log_server_event({ level: 'error', message: 'media_sweep_failed', error: err })
  } finally {
    state.in_flight = false
  }
}
