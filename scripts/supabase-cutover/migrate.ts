import type Database from 'better-sqlite3'
import type { PoolClient } from 'pg'
import type { Row } from './mappers'
import type { ConversionMismatch } from './richtext'
import { appendFileSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { postgres } from '../config-supabase'
import { insert_rows, prune_orphans, set_last_modified_to_max, upsert_rows } from './db-insert'
import { create_logger } from './logger'
import {
  build_sentence_order,
  DICT_JSON_COLS,
  map_audio,
  map_dialect,
  build_dict_sources,
  resolve_audio_source_names,
  map_dictionary,
  map_dictionary_partner,
  map_dictionary_role,
  map_entry,
  map_invite,
  map_junction,
  map_orthographies,
  map_photo,
  map_sense,
  map_sentence,
  map_speaker,
  map_tag,
  map_text,
  map_user,
  map_video,
  rewrite_orthography_keys,
  SHARED_JSON_COLS,
  synthesize_missing_orthographies,
} from './mappers'
import { LATEST_DICT_MIGRATION, open_dict_db, open_shared_db } from './open-sqlite'
import * as read from './read'
import { merge_user_row, plan_user_identity, read_existing_users, remap_rows_user_ids } from './remap'
import { create_conversion_stats } from './conversion-stats'
import { convert_multistring_isolated, convert_value_isolated, shutdown_conversion_pool } from './richtext-pool'

const here = dirname(fileURLToPath(import.meta.url))
const DEFAULT_DATA_DIR = resolve(here, '../../../site/.data')

function get_flag(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(name)
  if (index !== -1 && process.argv[index + 1] && !process.argv[index + 1].startsWith('--'))
    return process.argv[index + 1]
  return fallback
}
const has_flag = (name: string) => process.argv.includes(name)

/** Per-content-table mapper config. Junction tables get a synthetic UUID PK. */
const CONTENT_CONFIG: Record<string, { map?: (row: Row) => Row, json?: string[], junction?: string[] }> = {
  entries: { map: map_entry, json: DICT_JSON_COLS.entries },
  texts: { map: map_text, json: DICT_JSON_COLS.texts },
  sentences: { map: map_sentence, json: DICT_JSON_COLS.sentences },
  senses: { map: map_sense, json: DICT_JSON_COLS.senses },
  senses_in_sentences: { junction: ['sense_id', 'sentence_id'] },
  speakers: { map: map_speaker },
  audio: { map: map_audio },
  audio_speakers: { junction: ['audio_id', 'speaker_id'] },
  videos: { map: map_video, json: DICT_JSON_COLS.videos },
  video_speakers: { junction: ['video_id', 'speaker_id'] },
  sense_videos: { junction: ['sense_id', 'video_id'] },
  sentence_videos: { junction: ['sentence_id', 'video_id'] },
  photos: { map: map_photo },
  sense_photos: { junction: ['sense_id', 'photo_id'] },
  sentence_photos: { junction: ['sentence_id', 'photo_id'] },
  dialects: { map: map_dialect, json: DICT_JSON_COLS.dialects },
  entry_dialects: { junction: ['entry_id', 'dialect_id'] },
  tags: { map: map_tag },
  entry_tags: { junction: ['entry_id', 'tag_id'] },
}

// ---------------------------------------------------------------------------
// Manifest — the run's durable record: per-dict counts, synthesized rows,
// conversion stats, timings. Enables `--skip-existing` resume and lets
// verify.ts account for rows the migration legitimately ADDS (audio-source
// resolution). Written atomically after every dict.
// ---------------------------------------------------------------------------

interface DictManifest {
  counts: Record<string, number>
  synthesized: { speakers: number, audio_speakers: number, sources: number }
  /** rows removed post-insert because their (soft-deleted) parent wasn't migrated */
  pruned: Record<string, number>
  conversion: { converted: number, passed_through: number, emptied: number, mismatches: number }
  ms: number
  finished_at: string
}

interface Manifest {
  started_at: string
  finished_at?: string
  argv: string[]
  identity?: {
    matched_prod_users: { email: string, supabase_id: string, prod_id: string }[]
    supabase_dupes: { email: string, winner_id: string, loser_ids: string[] }[]
    remapped_ids: number
  }
  shared?: {
    users: number
    dictionaries: number
    dictionary_roles: number
    dictionary_partners: number
    invites: number
    conversion: { converted: number, passed_through: number, emptied: number, mismatches: number }
  }
  dicts: Record<string, DictManifest>
}

function manifest_path(data_dir: string) {
  return join(data_dir, 'migration-manifest.json')
}

function load_manifest(data_dir: string): Manifest | null {
  const path = manifest_path(data_dir)
  if (!existsSync(path))
    return null
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function write_manifest(data_dir: string, manifest: Manifest) {
  const path = manifest_path(data_dir)
  writeFileSync(`${path}.tmp`, JSON.stringify(manifest, null, 1))
  renameSync(`${path}.tmp`, path)
}

function record_mismatches(data_dir: string, dict_id: string, mismatches: ConversionMismatch[]) {
  if (mismatches.length === 0)
    return
  const path = join(data_dir, 'richtext-mismatches.jsonl')
  const lines = mismatches.map(mismatch => JSON.stringify({ dict_id, ...mismatch })).join('\n')
  appendFileSync(path, `${lines}\n`)
}

// ---------------------------------------------------------------------------

async function migrate_users({ client, shared, skip_writes = false }: { client: PoolClient, shared: Database.Database, skip_writes?: boolean }) {
  const [auth_users, profiles, user_data, identities] = await Promise.all([
    read.read_auth_users(client),
    read.read_profiles(client),
    read.read_user_data(client),
    read.read_identities_by_user(client),
  ])
  const profile_by_id = new Map(profiles.map(profile => [profile.id, profile]))
  const user_data_by_id = new Map(user_data.map(data => [data.id, data]))

  const existing_users = read_existing_users(shared)
  const existing_by_id = new Map(existing_users.map(user => [String(user.id), user]))
  const plan = plan_user_identity({ auth_users, existing_users })
  const final_id = (id: string) => plan.remap.get(id) ?? id

  // Resume pass: the shared phase already ran — only the (deterministic)
  // identity plan is needed for content remapping.
  if (skip_writes)
    return { user_count: 0, plan, skipped: true }

  // One row per FINAL id: dupe-losers fold their providers into the winner.
  const group_by_final = new Map<string, Row[]>()
  for (const auth_user of auth_users) {
    const key = final_id(String(auth_user.id))
    if (!group_by_final.has(key))
      group_by_final.set(key, [])
    group_by_final.get(key)!.push(auth_user)
  }

  const rows: Row[] = []
  for (const [id, group] of group_by_final) {
    // Winner = the group member whose id maps to (or is) the final id, else most recent.
    const winner = group.find(user => String(user.id) === id) ?? group[0]
    const providers = group.flatMap(user => identities.get(user.id) ?? [])
    const deduped: { provider: string, provider_id: string }[] = []
    const seen = new Set<string>()
    for (const provider of providers) {
      const key = `${provider.provider} ${provider.provider_id}`
      if (!seen.has(key)) {
        seen.add(key)
        deduped.push(provider)
      }
    }
    let row = map_user({
      auth_user: winner,
      profile: profile_by_id.get(winner.id),
      user_data: user_data_by_id.get(winner.id),
      providers: deduped,
    })
    row.id = id
    const existing = existing_by_id.get(id)
    if (existing)
      row = merge_user_row({ mapped: row, existing })
    rows.push(row)
  }

  upsert_rows({ db: shared, table: 'users', rows, json_cols: SHARED_JSON_COLS.users })
  return { user_count: rows.length, plan, skipped: false }
}

async function migrate_catalog({ client, shared, dicts, plan, data_dir }: {
  client: PoolClient
  shared: Database.Database
  dicts: Row[]
  plan: { remap: Map<string, string>, final_user_ids: Set<string> }
  data_dir: string
}) {
  const dict_ids = new Set(dicts.map(dict => dict.id))
  const info_by_id = new Map((await read.read_dictionary_info(client)).map(info => [info.id, info]))
  const entry_counts = await read.read_all_entry_counts(client)
  const final_id = (id: string) => plan.remap.get(id) ?? id
  const nullify_missing = (user_id: any) => (user_id && plan.final_user_ids.has(final_id(user_id)) ? final_id(user_id) : null)
  const conversion = create_conversion_stats()

  // dictionaries — about/grammar HTML→markdown happens here (info is merged in)
  const dict_rows: Row[] = []
  for (const dict of dicts) {
    const row = map_dictionary({ dict, info: info_by_id.get(dict.id), entry_count: entry_counts.get(dict.id) ?? 0 })
    row.about = await convert_value_isolated({ value: row.about, where: `${dict.id}.about`, stats: conversion })
    row.grammar = await convert_value_isolated({ value: row.grammar, where: `${dict.id}.grammar`, stats: conversion })
    row.created_by_user_id = nullify_missing(row.created_by_user_id)
    row.updated_by_user_id = nullify_missing(row.updated_by_user_id)
    // Mark schema-current so the server's startup migration sweep
    // (hooks.server.ts) doesn't synchronously create empty dict.dbs for every
    // catalog row. Dicts whose content we migrate get this re-confirmed; dicts
    // with no content yet are created lazily by `get_dictionary_db` on access.
    row.dict_db_schema_version = LATEST_DICT_MIGRATION
    dict_rows.push(row)
  }
  upsert_rows({ db: shared, table: 'dictionaries', rows: dict_rows, json_cols: SHARED_JSON_COLS.dictionaries })

  // roles — delete-then-insert scoped to migrated dicts (synthetic UUID PK)
  const roles = (await read.read_dictionary_roles(client))
    .filter(role => dict_ids.has(role.dictionary_id) && plan.final_user_ids.has(final_id(role.user_id)))
    .map((role) => {
      const row = map_dictionary_role(role)
      row.user_id = final_id(row.user_id)
      row.invited_by_user_id = nullify_missing(row.invited_by_user_id)
      return row
    })
  delete_for_dicts({ db: shared, table: 'dictionary_roles', dict_ids })
  insert_rows({ db: shared, table: 'dictionary_roles', rows: dedupe_roles(roles) })

  // partners — denormalize the logo, fetching only the referenced photos
  const all_partners = (await read.read_dictionary_partners(client)).filter(partner => dict_ids.has(partner.dictionary_id))
  const partner_photo_ids = all_partners.map(partner => partner.photo_id).filter(Boolean) as string[]
  const photos_by_id = new Map((await read.read_photos_by_ids(client, partner_photo_ids)).map(photo => [photo.id, photo]))
  const partners = all_partners
    .map(partner => map_dictionary_partner({ partner, photo: partner.photo_id ? photos_by_id.get(partner.photo_id) : undefined }))
  delete_for_dicts({ db: shared, table: 'dictionary_partners', dict_ids })
  insert_rows({ db: shared, table: 'dictionary_partners', rows: partners })

  // invites — upsert by id
  const invites = (await read.read_invites(client))
    .filter(invite => dict_ids.has(invite.dictionary_id) && plan.final_user_ids.has(final_id(invite.created_by)))
    .map((invite) => {
      const row = map_invite(invite)
      row.inviter_user_id = final_id(row.inviter_user_id)
      return row
    })
  upsert_rows({ db: shared, table: 'invites', rows: invites })

  record_mismatches(data_dir, '_catalog', conversion.mismatches)
  return {
    dictionaries: dict_rows.length,
    dictionary_roles: roles.length,
    dictionary_partners: partners.length,
    invites: invites.length,
    conversion: { converted: conversion.converted, passed_through: conversion.passed_through, emptied: conversion.emptied, mismatches: conversion.mismatches.length },
  }
}

/**
 * The remap can fold two Supabase accounts into one user, turning distinct
 * (dictionary_id, user_id, role) rows into duplicates that would violate the
 * natural-key UNIQUE. Keep the earliest.
 */
function dedupe_roles(roles: Row[]): Row[] {
  const seen = new Map<string, Row>()
  for (const role of roles) {
    const key = `${role.dictionary_id} ${role.user_id} ${role.role}`
    const kept = seen.get(key)
    if (!kept || String(role.created_at) < String(kept.created_at))
      seen.set(key, role)
  }
  return [...seen.values()]
}

function delete_for_dicts({ db, table, dict_ids }: { db: Database.Database, table: string, dict_ids: Set<string> }) {
  if (dict_ids.size === 0)
    return
  const placeholders = Array.from(dict_ids).map(() => '?').join(', ')
  db.prepare(`DELETE FROM ${table} WHERE dictionary_id IN (${placeholders})`).run(...dict_ids)
}

/** Below this many (live) entries a dict's tables are read via single SELECTs, not cursors. */
const SIMPLE_READ_ENTRY_LIMIT = 500

async function migrate_dict_content({ client, data_dir, dict, shared, remap, entry_count_hint }: {
  client: PoolClient
  data_dir: string
  dict: Row
  shared: Database.Database
  remap: Map<string, string>
  entry_count_hint: number
}): Promise<DictManifest> {
  const started = Date.now()
  const final_creator = remap.get(dict.created_by) ?? dict.created_by
  const db = open_dict_db({ data_dir, dict_id: dict.id, rebuild: true })
  db.pragma('foreign_keys = OFF') // source data is already FK-valid; speeds bulk insert + dodges orphan-ordering issues
  const counts: Record<string, number> = {}
  const synthesized = { speakers: 0, audio_speakers: 0, sources: 0 }
  let pruned: Record<string, number> = {}
  const conversion = create_conversion_stats()
  // Positional `lo{n}` lexeme/text keys → the new immutable orthography `code`.
  const { orthographies: declared_orthographies, lo_to_code } = map_orthographies(dict.orthographies)
  // lo{n} keys used in content but NOT declared in the dict's orthographies
  // get a synthesized registry entry (see synthesize_missing_orthographies).
  const extra_orthographies: Row[] = []
  // texts (read before sentences) yields per-sentence order derived from the
  // legacy id-array; applied to sentence rows as sort_key + ends_paragraph.
  let sentence_order = new Map<string, { sort_key: string, ends_paragraph: number | null }>()
  // Slugs taken by the entry-sources registry — audio-source resolution
  // dedupes against them. speakers + audio are BUFFERED (not inserted at their
  // loop position) until audio_speakers is read, because the legacy free-text
  // `audio.source` person-names resolve into speaker links / new speakers /
  // registry citations (see resolve_audio_source_names).
  const registry_slugs = new Set<string>()
  let buffered_speakers: Row[] = []
  let buffered_audio: Row[] = []
  try {
    const simple = entry_count_hint < SIMPLE_READ_ENTRY_LIMIT
    for (const table of read.DICT_CONTENT_TABLES) {
      const config = CONTENT_CONFIG[table]
      const source_rows = await read.read_dict_table(client, table, dict.id, { simple })
      if (table === 'texts')
        sentence_order = build_sentence_order(source_rows)
      const rows = config.junction
        ? source_rows.map(row => map_junction(row, config.junction!))
        : source_rows.map(row => config.map!(row))
      remap_rows_user_ids(rows, remap)
      if (table === 'entries') {
        extra_orthographies.push(...synthesize_missing_orthographies({ rows, key: 'lexeme', lo_to_code, existing: declared_orthographies ? [...declared_orthographies, ...extra_orthographies] : extra_orthographies }))
        for (const row of rows) {
          row.lexeme = rewrite_orthography_keys(row.lexeme, lo_to_code)
          if (row.notes)
            row.notes = await convert_multistring_isolated({ value: row.notes, where: `${row.id}.notes`, stats: conversion })
        }
      }
      if (table === 'sentences') {
        extra_orthographies.push(...synthesize_missing_orthographies({ rows, key: 'text', lo_to_code, existing: declared_orthographies ? [...declared_orthographies, ...extra_orthographies] : extra_orthographies }))
        for (const row of rows) {
          row.text = rewrite_orthography_keys(row.text, lo_to_code)
          const order = sentence_order.get(row.id)
          if (order) {
            row.sort_key = order.sort_key
            row.ends_paragraph = order.ends_paragraph
          }
        }
      }
      if (table === 'entries') {
        // Convert each entry's free-text `sources` into a per-dict registry +
        // slug refs BEFORE inserting the (rewritten) entry rows.
        const source_rows = build_dict_sources({ entry_rows: rows, user_id: final_creator || rows[0]?.created_by_user_id || 'cutover' })
        for (const source_row of source_rows)
          registry_slugs.add(source_row.slug)
        counts.sources = insert_rows({ db, table: 'sources', rows: remap_rows_user_ids(source_rows, remap) })
      }
      if (table === 'speakers') {
        buffered_speakers = rows
        continue
      }
      if (table === 'audio') {
        buffered_audio = rows
        continue
      }
      if (table === 'audio_speakers') {
        const resolution = resolve_audio_source_names({
          audio_rows: buffered_audio,
          speaker_rows: buffered_speakers,
          junction_rows: rows,
          existing_slugs: registry_slugs,
          user_id: final_creator || 'cutover',
        })
        synthesized.speakers = resolution.new_speakers.length
        synthesized.audio_speakers = resolution.new_audio_speakers.length
        synthesized.sources = resolution.new_sources.length
        counts.speakers = insert_rows({ db, table: 'speakers', rows: remap_rows_user_ids([...buffered_speakers, ...resolution.new_speakers], remap) })
        counts.audio = insert_rows({ db, table: 'audio', rows: buffered_audio })
        counts.sources = (counts.sources ?? 0) + insert_rows({ db, table: 'sources', rows: remap_rows_user_ids(resolution.new_sources, remap) })
        counts[table] = insert_rows({ db, table, rows: remap_rows_user_ids([...rows, ...resolution.new_audio_speakers], remap) })
        continue
      }
      counts[table] = insert_rows({ db, table, rows, json_cols: config.json })
    }
    // Live children of soft-deleted parents (we skip tombstones at read time)
    // now dangle — prune them. The old app never showed them anyway (every
    // query filtered `deleted IS NULL` on the parent).
    pruned = prune_orphans(db)
    set_last_modified_to_max({ db, tables: [...read.DICT_CONTENT_TABLES, 'sources'] })
    counts.entries_final = (db.prepare(`SELECT COUNT(*) AS count FROM entries`).get() as { count: number }).count
  } finally {
    db.pragma('foreign_keys = ON')
    const violations = db.pragma('foreign_key_check') as unknown[]
    if (violations.length)
      process.stderr.write(`  ⚠️ ${dict.id}: ${violations.length} FK violations survived pruning\n`)
    db.close()
  }

  const entry_count = counts.entries_final ?? 0
  delete counts.entries_final
  shared.prepare(`UPDATE dictionaries SET dict_db_schema_version = ?, entry_count = ? WHERE id = ?`)
    .run(LATEST_DICT_MIGRATION, entry_count, dict.id)

  // Persist any orthographies synthesized from undeclared `lo{n}` content keys
  // into the catalog so the headword fallback + settings page see them.
  if (extra_orthographies.length) {
    const merged = [...(declared_orthographies ?? []), ...extra_orthographies]
    shared.prepare(`UPDATE dictionaries SET orthographies = ? WHERE id = ?`).run(JSON.stringify(merged), dict.id)
  }

  record_mismatches(data_dir, dict.id, conversion.mismatches)
  return {
    counts,
    synthesized,
    pruned,
    conversion: { converted: conversion.converted, passed_through: conversion.passed_through, emptied: conversion.emptied, mismatches: conversion.mismatches.length },
    ms: Date.now() - started,
    finished_at: new Date().toISOString(),
  }
}

async function run_content_pool({ dicts, concurrency, worker }: {
  dicts: Row[]
  concurrency: number
  worker: (dict: Row) => Promise<void>
}): Promise<void> {
  let next = 0
  const runners = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (next < dicts.length) {
      const dict = dicts[next++]
      await worker(dict)
    }
  })
  await Promise.all(runners)
}

async function main() {
  const data_dir = get_flag('--data-dir', DEFAULT_DATA_DIR)!
  const dict_id = get_flag('--dict-id')
  const limit_raw = get_flag('--limit')
  const limit = limit_raw ? Number(limit_raw) : undefined
  const dry = has_flag('--dry')
  const shared_only = has_flag('--shared-only')
  const skip_existing = has_flag('--skip-existing')
  const since = get_flag('--since')
  const concurrency = Number(get_flag('--concurrency', '4'))
  // Full catalog for ALL dicts, content only for this subset (comma-separated ids).
  const content_dicts_raw = get_flag('--content-dicts')
  const content_subset = content_dicts_raw ? new Set(content_dicts_raw.split(',').map(id => id.trim())) : null

  const log = create_logger(join(data_dir, 'migration-run.log'))
  const client = await postgres.get_db_connection()
  const started = Date.now()
  const started_at = new Date().toISOString()
  try {
    // Catalog scope: all dicts unless --dict-id/--limit narrow it.
    const catalog_dicts = (content_subset || since || shared_only)
      ? await read.read_dictionaries(client, {})
      : await read.read_dictionaries(client, { dict_id, limit })

    const previous = skip_existing ? load_manifest(data_dir) : null
    const changed_ids = since ? await read.read_changed_dict_ids(client, since) : null

    let content_dicts = catalog_dicts
    if (content_subset)
      content_dicts = content_dicts.filter(dict => content_subset.has(dict.id))
    if (changed_ids)
      content_dicts = content_dicts.filter(dict => changed_ids.has(dict.id))
    if (shared_only)
      content_dicts = []
    if (previous)
      content_dicts = content_dicts.filter(dict => !previous.dicts[dict.id]?.finished_at)

    log(`Migrating Supabase → SQLite`)
    log(`  data_dir: ${data_dir}`)
    log(`  catalog: ${catalog_dicts.length} dicts · content: ${content_dicts.length} dicts`
      + `${since ? ` (delta since ${since})` : ''}${shared_only ? ' (shared only)' : ''}`
      + `${previous ? ` (resume: ${Object.keys(previous.dicts).length} already done)` : ''}${dry ? ' (dry run)' : ''}`)

    if (dry) {
      const entry_counts = await read.read_all_entry_counts(client)
      for (const dict of content_dicts)
        log(`  ${dict.id} — "${dict.name}" — ${entry_counts.get(dict.id) ?? 0} entries`)
      log(`Dry run — nothing written.`)
      return
    }

    const manifest: Manifest = previous ?? { started_at, argv: process.argv.slice(2), dicts: {} }

    const shared = open_shared_db(data_dir)
    // The remap plan is needed for content even when the shared phase is
    // skipped on a resume pass — identity planning is cheap and idempotent.
    log('shared.db:')
    const { user_count, plan, skipped: shared_skipped } = await migrate_users({ client, shared, skip_writes: Boolean(previous?.shared) })
    if (shared_skipped) {
      log('  shared phase already recorded in manifest — skipped (resume pass)')
    } else {
      log(`  users: ${user_count} (remapped ids: ${plan.remap.size}, matched prod users: ${plan.report.matched_prod_users.length}, supabase dupes: ${plan.report.supabase_dupes.length})`)
      for (const match of plan.report.matched_prod_users)
        log(`    prod-id wins: ${match.email} ${match.supabase_id} → ${match.prod_id}`)
      for (const dupe of plan.report.supabase_dupes)
        log(`    supabase dupe: ${dupe.email} losers [${dupe.loser_ids.join(', ')}] → ${dupe.winner_id}`)

      const shared_counts = await migrate_catalog({ client, shared, dicts: catalog_dicts, plan, data_dir })
      log(`  dictionaries: ${shared_counts.dictionaries} · roles: ${shared_counts.dictionary_roles} · partners: ${shared_counts.dictionary_partners} · invites: ${shared_counts.invites}`)
      log(`  about/grammar conversion: ${JSON.stringify(shared_counts.conversion)}`)

      manifest.identity = { ...plan.report, remapped_ids: plan.remap.size }
      manifest.shared = { users: user_count, ...shared_counts }
      write_manifest(data_dir, manifest)
    }

    if (content_dicts.length) {
      const entry_counts = await read.read_all_entry_counts(client)
      log(`\ndictionaries/ (${content_dicts.length} files, concurrency ${concurrency}):`)
      let done = 0
      await run_content_pool({
        dicts: content_dicts,
        concurrency,
        worker: async (dict) => {
          const worker_client = await postgres.get_db_connection()
          try {
            const result = await migrate_dict_content({ client: worker_client, data_dir, dict, shared, remap: plan.remap, entry_count_hint: entry_counts.get(dict.id) ?? 0 })
            manifest.dicts[dict.id] = result
            done++
            const total_rows = Object.values(result.counts).reduce((sum, count) => sum + count, 0)
            log(`  ✓ [${done}/${content_dicts.length}] ${dict.id}: ${result.counts.entries ?? 0} entries, ${total_rows} rows, ${(result.ms / 1000).toFixed(1)}s`)
            write_manifest(data_dir, manifest)
          } catch (error) {
            log(`  ✗ ${dict.id} FAILED: ${(error as Error).message}`)
            throw error
          } finally {
            worker_client.release()
          }
        },
      })
      // Rebuilt dict dbs need fresh R2 snapshots; untouched dicts keep whatever
      // snapshot state prod already has (map_dictionary omits the column).
      const clear_snapshot = shared.prepare('UPDATE dictionaries SET snapshot_uploaded_at = NULL WHERE id = ?')
      for (const dict of content_dicts)
        clear_snapshot.run(dict.id)
    }

    manifest.finished_at = new Date().toISOString()
    write_manifest(data_dir, manifest)
    shared.close()
    log(`\n✓ Done in ${((Date.now() - started) / 1000).toFixed(1)}s`)
  } finally {
    shutdown_conversion_pool()
    client.release()
    await postgres.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
