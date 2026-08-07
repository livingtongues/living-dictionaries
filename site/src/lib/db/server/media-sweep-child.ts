import { spawnSync } from 'node:child_process'
import { setPriority } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import Database from 'better-sqlite3'
import { building } from '$app/environment'
import { get_r2_media } from '$lib/server/r2-media'
import { generate_and_store_photo_variants } from '$lib/server/photo-variants'
import { generate_and_store_video_thumbnail } from '$lib/server/video-thumbnails'
import { audio_playback_key, photo_variant_key, PHOTO_VARIANTS } from '$lib/utils/media-path'
import { dictionary_db_path } from './dictionary-db'
import { parse_media_key } from './media-ledger'
import type { MediaMetadataProbeSummary } from './media-metadata-probe'
import { run_media_metadata_probe_once } from './media-metadata-probe'
import { get_shared_db } from './shared-db'

/** The bundled chunk this module lives in — the thing the parent forks. */
export const MEDIA_SWEEP_MODULE_URL = import.meta.url

/** Nice 19: the child physically cannot outrank request serving on a 2-vCPU box. */
export const CHILD_NICE = 19
/** Idle I/O class — the job is R2 transfers plus a lot of small SQLite writes. */
export const CHILD_IONICE_CLASS = 3
/** The child serves nobody, so it may wait as long as it takes for a write lock. */
const CHILD_BUSY_TIMEOUT_MS = 60_000

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
 * Only valid R2 media keys participate.
 *
 * THE ONE INVARIANT OF THE MARKING PASS (2026-08-02): a FAILED READ MUST NEVER
 * PRODUCE AN EMPTY IN-USE SET. Until now the dict.db read sat in a `try` whose
 * `catch` body was a comment — any failure (missing file, locked db, renamed
 * column) yielded zero live keys, which marked every one of that dictionary's
 * stored files as an orphan and started a 30-day deletion countdown on real user
 * media. The grace period made a BRIEF failure harmless; nothing made a QUIET
 * PERSISTENT one distinguishable from a genuinely emptied dictionary. Now such a
 * dictionary is logged and skipped, and a proportion brake refuses an implausible
 * share of one dictionary going unreferenced at once. See
 * `.knowledge/server/catch-blocks-that-fabricate-state.md`.
 *
 * WHERE THIS RUNS — a `nice 19` / `ionice -c 3` CHILD PROCESS, since 2026-08-07.
 * The parent half (forking, telemetry) is `media-sweep-cron.ts`. It used to be a
 * plain roster job in the SERVING process, and on 2026-08-06 a full listing of
 * 381,719 R2 objects reconciled against the ledger froze the event loop for
 * 20,233 ms — the day's second-worst stall — with a user taking a 502 in the same
 * second. The object count grew 62% in a week (235,113 → 381,719), so the freeze
 * gets worse weekly. Its siblings (retention, analytics, audio derivatives) were
 * all moved out for the same reason; this was the last one left in-process.
 *
 * TWO CONSEQUENCES of running as a forked CHUNK (identical to
 * `audio-derivative-backfill.ts` — read its header for the full mechanics):
 *  - the parent reaches this module through a DYNAMIC import, which is what
 *    guarantees it gets a chunk of its OWN. Folded into the hooks chunk, forking
 *    it would boot a second cron scheduler inside every sweep child.
 *  - `$env/dynamic/private` is EMPTY here (`Server.init()` never runs), so
 *    `r2-media.ts` falls back to `process.env` for its credentials.
 *
 * And the load-bearing DB rule: the child NEVER calls `get_shared_db()` — that
 * would run migrations from a process that is not the server. It opens shared.db
 * directly (read-WRITE: this job's whole output is ledger rows) with a long busy
 * timeout, and threads that handle through every helper it calls.
 */

const RECONCILE_EVERY_MS = 6.5 * 24 * 60 * 60 * 1000
const ORPHAN_GRACE_MS = 30 * 24 * 60 * 60 * 1000
/** Presign-seeded ledger rows younger than this may simply not have finished uploading. */
const ABANDONED_PRESIGN_GRACE_MS = 60 * 60 * 1000
const DELETE_CAP_PER_RUN = 5000
const VARIANT_HEAL_CAP_PER_RUN = 200
/** Videos are fetched back whole + run through ffmpeg — heavier than photo variants, so a smaller cap. */
const VIDEO_THUMB_HEAL_CAP_PER_RUN = 40
const RECONCILE_WATERMARK_KEY = 'media_sweep_last_reconcile'

export function run_media_rollup_once({ db = get_shared_db() }: { db?: Database.Database } = {}): void {
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

/**
 * What one dictionary's live rows reference — or an honest refusal to answer.
 *
 * `ok: false` means "I could not read this dictionary", NOT "it references
 * nothing". The caller must skip such a dictionary entirely; see the marking
 * pass for why that distinction is the whole safety property here.
 */
export interface LiveKeysResult {
  ok: boolean
  keys: Set<string>
  /**
   * The dictionary is gone from the catalog — an empty live set is then the
   * TRUTH, not a failure, and its media is genuinely reclaimable.
   */
  dictionary_deleted: boolean
  error?: string
}

/** Every new-convention key a dict's live rows reference (incl. derived photo variant keys). */
export function live_keys_for_dict(dict_id: string, { shared = get_shared_db() }: { shared?: Database.Database } = {}): LiveKeysResult {
  const keys = new Set<string>()
  const add = (path: string | null | undefined) => {
    if (!path || !parse_media_key(path))
      return
    keys.add(path)
    const { media_type } = parse_media_key(path)
    if (media_type === 'photo') {
      for (const variant of PHOTO_VARIANTS)
        keys.add(photo_variant_key({ original_key: path, variant }))
    } else if (media_type === 'audio') {
      keys.add(audio_playback_key({ original_key: path }))
    } else if (media_type === 'video') {
      // Videos derive only a single `_thumb.webp` sibling (no w900/w1600) — keep it
      // in the live set so the orphan sweep never deletes a generated thumbnail.
      keys.add(photo_variant_key({ original_key: path, variant: 'thumb' }))
    }
  }
  // A dictionary the catalog no longer knows is DELETED: its file is gone on
  // purpose and its media should be reclaimed. Anything else that fails to read
  // is a fault, and a fault must never be answered with an empty set.
  const dictionary_deleted = !shared.prepare(`SELECT 1 FROM dictionaries WHERE id = ?`).get(dict_id)
  if (!dictionary_deleted) {
    try {
      const db = new Database(dictionary_db_path(dict_id), { readonly: true, fileMustExist: true })
      let tables_read = 0
      try {
        for (const table of ['audio', 'videos', 'photos']) {
          const has = db.prepare(`SELECT 1 FROM sqlite_master WHERE name = ?`).get(table)
          if (!has)
            continue // a pre-migration file may predate a table; the proportion brake covers the rest
          tables_read++
          for (const row of db.prepare(`SELECT storage_path FROM ${table} WHERE storage_path IS NOT NULL`).all() as { storage_path: string }[])
            add(row.storage_path)
        }
      } finally {
        db.close()
      }
      // None of the three media tables present: this is not a dictionary db we
      // understand, so we have not actually read anything.
      if (tables_read === 0)
        throw new Error('no audio/videos/photos table found')
    } catch (err) {
      return { ok: false, keys, dictionary_deleted, error: (err as Error)?.message ?? String(err) }
    }
  }
  for (const row of shared.prepare(`SELECT photo_storage_path FROM dictionary_partners WHERE dictionary_id = ? AND photo_storage_path IS NOT NULL`).all(dict_id) as { photo_storage_path: string }[])
    add(row.photo_storage_path)
  const dict_row = shared.prepare(`SELECT featured_image FROM dictionaries WHERE id = ?`).get(dict_id) as { featured_image: string | null } | undefined
  if (dict_row?.featured_image) {
    try {
      add(JSON.parse(dict_row.featured_image)?.storage_path)
    } catch { /* malformed legacy JSON */ }
  }
  return { ok: true, keys, dictionary_deleted }
}

/**
 * How much of ONE dictionary's stored media may become newly-orphaned in a
 * single sweep before we stop and ask a human. The 30-day grace already protects
 * against a BRIEF fault; nothing protected against a QUIET one that persists —
 * a renamed column, a half-restored file, a bug in the key derivation — which
 * reads exactly like a genuinely emptied dictionary.
 *
 * A dictionary whose catalog row is gone is exempt: emptying is then the point.
 */
const BRAKE_MIN_OBJECTS = 20
const BRAKE_MAX_NEWLY_ORPHANED_SHARE = 0.5

export function orphan_brake_tripped({ objects, newly_orphaned, dictionary_deleted }: {
  objects: number
  newly_orphaned: number
  dictionary_deleted: boolean
}): boolean {
  if (dictionary_deleted || objects < BRAKE_MIN_OBJECTS)
    return false
  return newly_orphaned / objects > BRAKE_MAX_NEWLY_ORPHANED_SHARE
}

export interface MediaReconcileSummary {
  listed: number
  adopted: number
  size_fixed: number
  ledger_rows_dropped: number
  newly_orphaned: number
  unorphaned: number
  /** Dictionaries skipped because their live rows could not be read (see `media_sweep_dict_unreadable`). */
  dicts_unreadable: number
  /** Dictionaries whose marking was refused by the proportion brake (see `media_orphan_brake_tripped`). */
  dicts_braked: number
  deleted: number
  variants_healed: number
  variant_heal_failures: number
  video_thumbs_healed: number
  video_thumb_heal_failures: number
  /**
   * Where the time actually went — the shape `snapshot_sweep_completed` has
   * reported for weeks and this job did not, so 2026-08-06's 20.2 s freeze had to
   * be INFERRED from a host sample that happened to land in the same window.
   */
  duration_ms: number
  step_ms: { list: number, ledger_diff: number, heal: number }
  /**
   * Errors the child found but cannot report itself (it has no telemetry handle
   * — see the module header). The PARENT ships these as `media_sweep_dict_unreadable`
   * / `media_orphan_brake_tripped`. Capped: a systemic fault must not turn one
   * summary into a thousand-entry IPC payload.
   */
  alerts: { message: 'media_sweep_dict_unreadable' | 'media_orphan_brake_tripped', context: Record<string, unknown> }[]
}

/** How many per-dictionary alerts ride home in the summary before we just count them. */
const MAX_ALERTS_PER_RUN = 50

export async function run_media_reconcile_once({ db = get_shared_db() }: { db?: Database.Database } = {}): Promise<MediaReconcileSummary> {
  const started = performance.now()
  const { client, bucket } = get_r2_media()
  const now = Date.now()
  const now_iso = new Date(now).toISOString()
  const summary: MediaReconcileSummary = { listed: 0, adopted: 0, size_fixed: 0, ledger_rows_dropped: 0, newly_orphaned: 0, unorphaned: 0, dicts_unreadable: 0, dicts_braked: 0, deleted: 0, variants_healed: 0, variant_heal_failures: 0, video_thumbs_healed: 0, video_thumb_heal_failures: 0, duration_ms: 0, step_ms: { list: 0, ledger_diff: 0, heal: 0 }, alerts: [] }
  const alert = (message: MediaReconcileSummary['alerts'][number]['message'], context: Record<string, unknown>): void => {
    if (summary.alerts.length < MAX_ALERTS_PER_RUN)
      summary.alerts.push({ message, context })
  }

  // 0. LIST — the expensive one. 381,719 objects and growing 62% a week; this is
  //    the step that used to hold the serving process' event loop for 20 seconds.
  const list_started = performance.now()
  const remote = await list_media_bucket()
  summary.listed = remote.size
  summary.step_ms.list = Math.round(performance.now() - list_started)

  // 1. Ledger true-up against the listing.
  const ledger_diff_started = performance.now()
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
  //
  // MARKING STARTS A 30-DAY DELETION CLOCK on real user media, so the input to it
  // must be a set we actually read. Two brakes, both added 2026-08-02:
  //   (a) a dictionary we could not READ is skipped whole and logged at error
  //       level — never treated as "references nothing" (which is what the old
  //       comment-only `catch` did, silently marking its entire library);
  //   (b) even on a good read, an implausible share of one dictionary's objects
  //       going unreferenced at once STOPS the marking and asks for a human.
  // Un-orphaning always runs: clearing a mark can only ever be safe.
  const dict_ids = (db.prepare(`SELECT DISTINCT dict_id FROM media_objects`).all() as { dict_id: string }[]).map(row => row.dict_id)
  const mark_orphan = db.prepare(`UPDATE media_objects SET orphaned_at = ? WHERE key = ? AND orphaned_at IS NULL`)
  const clear_orphan = db.prepare(`UPDATE media_objects SET orphaned_at = NULL WHERE key = ? AND orphaned_at IS NOT NULL`)
  for (const dict_id of dict_ids) {
    const live = live_keys_for_dict(dict_id, { shared: db })
    const rows = db.prepare(`SELECT key, orphaned_at FROM media_objects WHERE dict_id = ?`).all(dict_id) as { key: string, orphaned_at: string | null }[]
    if (!live.ok) {
      summary.dicts_unreadable++
      console.error(`[media-sweep] ${dict_id}: could not read live media rows (${live.error}) — skipping, nothing marked.`)
      alert('media_sweep_dict_unreadable', { dict_id, objects: rows.length, detail: live.error })
      continue
    }
    const newly_orphaned = rows.filter(row => !row.orphaned_at && !live.keys.has(row.key)).length
    const braked = orphan_brake_tripped({ objects: rows.length, newly_orphaned, dictionary_deleted: live.dictionary_deleted })
    if (braked) {
      summary.dicts_braked++
      console.error(`[media-sweep] ${dict_id}: ${newly_orphaned}/${rows.length} objects would be newly orphaned — refusing to mark.`)
      alert('media_orphan_brake_tripped', { dict_id, objects: rows.length, newly_orphaned, live_keys: live.keys.size })
    }
    db.transaction(() => {
      for (const row of rows) {
        if (live.keys.has(row.key)) {
          if (row.orphaned_at) {
            clear_orphan.run(row.key)
            summary.unorphaned++
          }
        } else if (!row.orphaned_at && !braked) {
          mark_orphan.run(now_iso, row.key)
          summary.newly_orphaned++
        }
      }
    })()
  }

  summary.step_ms.ledger_diff = Math.round(performance.now() - ledger_diff_started)

  // 3. REAL deletion of orphans past grace (capped per run).
  const heal_started = performance.now()
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
      await generate_and_store_photo_variants({ original_key: key, bytes, db })
      summary.variants_healed++
    } catch (err) {
      summary.variant_heal_failures++
      console.error(`[media-sweep] variant heal failed for ${key}: ${err.message}`)
    }
  }

  // 5. Self-heal video originals missing their `_thumb.webp` (browser uploads
  //    presign straight to R2, so the fast-path endpoint may have been skipped /
  //    failed; this also backfills older videos). Fetches the object back + ffmpeg.
  const videos_missing_thumb: string[] = []
  for (const [key] of remote) {
    const parsed = parse_media_key(key)
    if (!parsed || parsed.media_type !== 'video' || parsed.is_variant)
      continue
    if (!remote.has(photo_variant_key({ original_key: key, variant: 'thumb' })))
      videos_missing_thumb.push(key)
  }
  for (const key of videos_missing_thumb.slice(0, VIDEO_THUMB_HEAL_CAP_PER_RUN)) {
    try {
      const stored = await generate_and_store_video_thumbnail({ original_key: key, db })
      if (stored)
        summary.video_thumbs_healed++
      else
        summary.video_thumb_heal_failures++
    } catch (err) {
      summary.video_thumb_heal_failures++
      console.error(`[media-sweep] video thumb heal failed for ${key}: ${err.message}`)
    }
  }

  summary.step_ms.heal = Math.round(performance.now() - heal_started)

  db.prepare(`INSERT INTO db_metadata (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value`)
    .run(RECONCILE_WATERMARK_KEY, now_iso)
  summary.duration_ms = Math.round(performance.now() - started)
  return summary
}

export interface MediaSweepSummary {
  /** Wall clock for the WHOLE job (rollup + reconcile + probe), measured in the child. */
  duration_ms: number
  /** False when the 6.5-day watermark said the reconcile wasn't due — a cheap day. */
  reconciled: boolean
  reconcile: MediaReconcileSummary | null
  probe: MediaMetadataProbeSummary | null
  error?: string
}

/**
 * THE WHOLE JOB — daily ledger rollup + (when the weekly watermark is due) the
 * R2 reconcile / orphan cleanup / variant self-heal / metadata probe.
 *
 * Runs in the CHILD, or inline in dev where there is no bundle to fork. Opens
 * shared.db ITSELF (read-write, long busy timeout) rather than calling
 * `get_shared_db()`, whose migration runner must only ever fire in the server.
 */
export async function run_media_sweep_job({ data_dir = process.env.DATA_DIR || '.data', now = Date.now() }: {
  data_dir?: string
  now?: number
} = {}): Promise<MediaSweepSummary> {
  const started = performance.now()
  const summary: MediaSweepSummary = { duration_ms: 0, reconciled: false, reconcile: null, probe: null }
  let db: Database.Database | null = null
  try {
    db = new Database(join(data_dir, 'shared.db'), { fileMustExist: true })
    db.pragma(`busy_timeout = ${CHILD_BUSY_TIMEOUT_MS}`)
    db.pragma('foreign_keys = ON')

    run_media_rollup_once({ db })

    const watermark = db.prepare(`SELECT value FROM db_metadata WHERE key = ?`).get(RECONCILE_WATERMARK_KEY) as { value: string } | undefined
    if (!watermark || now - Date.parse(watermark.value) > RECONCILE_EVERY_MS) {
      summary.reconciled = true
      summary.reconcile = await run_media_reconcile_once({ db })
      console.info(`[media-sweep] reconcile: ${JSON.stringify(summary.reconcile)}`)
      const probe = await run_media_metadata_probe_once({ db })
      summary.probe = probe
      if (probe.probed > 0)
        console.info(`[media-sweep] metadata probe: ${JSON.stringify(probe)}`)
    }
  } catch (err) {
    summary.error = (err as Error)?.message ?? String(err)
    console.error('[media-sweep] failed:', err)
  } finally {
    db?.close()
    summary.duration_ms = Math.round(performance.now() - started)
  }
  return summary
}

// ── Child entry ────────────────────────────────────────────────────────────
// Reached ONLY by `run_media_sweep` forking this chunk. In the server process
// the env var is absent and this is a single string comparison.

export interface SummaryMessage { type: 'summary', summary: MediaSweepSummary }

if (process.env.MEDIA_SWEEP_CHILD === '1' && !building) {
  void (async () => {
    try {
      setPriority(0, CHILD_NICE)
    } catch (error) {
      console.warn('[media-sweep] could not self-nice:', (error as Error).message)
    }
    const ionice = spawnSync('ionice', ['-c', String(CHILD_IONICE_CLASS), '-p', String(process.pid)], { stdio: 'ignore' })
    if (ionice.error || ionice.status !== 0)
      console.warn('[media-sweep] could not self-ionice:', ionice.error?.message ?? `exit ${ionice.status}`)
    const summary = await run_media_sweep_job()
    // Exit from the send CALLBACK: the IPC write is not guaranteed synchronous
    // and an immediate exit can truncate the summary the parent logs.
    if (process.send)
      process.send({ type: 'summary', summary } satisfies SummaryMessage, () => process.exit(0))
    else
      process.exit(0)
  })()
}
