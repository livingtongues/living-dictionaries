import type Database from 'better-sqlite3'
import type { HistoryEvent } from './dictionary-history-db'
import type { SingleWriteResult } from './v1-entry-write'
import type { DictSyncableTable } from '$lib/db/dict-syncable-tables'
import type { HostedMetadata, MediaTimings } from '$lib/db/schemas/dictionary.types'
import type { HostedVideo } from '$lib/types'
import { parse_dict_row } from '$lib/db/schemas/dictionary-json-columns'
import { read_last_modified_at } from './dictionary-db'
import { record_history } from './dictionary-history-db'
import { delete_dict_row, merge_dict_row } from './dictionary-sync-helpers'
import { load_source_slug_set } from './source-slugs'
import { run_tombstone_delete } from './v1-entry-write'

/**
 * `/api/v1` media writes — attach / replace / delete one audio, photo, or video
 * on an entry / sense / sentence / text. Single-row writes go through
 * `merge_dict_row` + `delete_dict_row` (same path + history as a browser editor
 * push), so audit stamping, sync triggers, and change-history all match a human
 * edit. Everything is parametrized by {@link MEDIA_CELLS} — one code path for all
 * eight owner→medium combinations. Byte storage + serving-url happen in the route
 * (see `$lib/server/media-storage.ts`); this module only touches the DB.
 */

export type MediaCellKey
  = | 'audio:entry' | 'audio:sentence' | 'audio:text'
    | 'photo:sense' | 'photo:sentence'
    | 'video:sense' | 'video:sentence' | 'video:text'

type LinkConfig
  = | { kind: 'column', column: string }
    | { kind: 'junction', table: DictSyncableTable, owner_col: string, media_col: string }

export interface MediaCellConfig {
  medium: 'audio' | 'photo' | 'video'
  media_table: DictSyncableTable
  owner_table: string
  /** SvelteKit route param carrying the owner id (e.g. `entryId`). */
  owner_param: string
  /** SvelteKit route param carrying the media id on DELETE (e.g. `audioId`). */
  media_param: string
  /** Storage-path folder segment: `audio` | `images` | `videos`. */
  folder: string
  link: LinkConfig
  /** Present for media that can carry a speaker (audio, video). */
  speaker?: { junction: DictSyncableTable, media_col: string }
}

export const MEDIA_CELLS: Record<MediaCellKey, MediaCellConfig> = {
  'audio:entry': { medium: 'audio', media_table: 'audio', owner_table: 'entries', owner_param: 'entryId', media_param: 'audioId', folder: 'audio', link: { kind: 'column', column: 'entry_id' }, speaker: { junction: 'audio_speakers', media_col: 'audio_id' } },
  'audio:sentence': { medium: 'audio', media_table: 'audio', owner_table: 'sentences', owner_param: 'sentenceId', media_param: 'audioId', folder: 'audio', link: { kind: 'column', column: 'sentence_id' }, speaker: { junction: 'audio_speakers', media_col: 'audio_id' } },
  'audio:text': { medium: 'audio', media_table: 'audio', owner_table: 'texts', owner_param: 'textId', media_param: 'audioId', folder: 'audio', link: { kind: 'column', column: 'text_id' }, speaker: { junction: 'audio_speakers', media_col: 'audio_id' } },
  'photo:sense': { medium: 'photo', media_table: 'photos', owner_table: 'senses', owner_param: 'senseId', media_param: 'photoId', folder: 'images', link: { kind: 'junction', table: 'sense_photos', owner_col: 'sense_id', media_col: 'photo_id' } },
  'photo:sentence': { medium: 'photo', media_table: 'photos', owner_table: 'sentences', owner_param: 'sentenceId', media_param: 'photoId', folder: 'images', link: { kind: 'junction', table: 'sentence_photos', owner_col: 'sentence_id', media_col: 'photo_id' } },
  'video:sense': { medium: 'video', media_table: 'videos', owner_table: 'senses', owner_param: 'senseId', media_param: 'videoId', folder: 'videos', link: { kind: 'junction', table: 'sense_videos', owner_col: 'sense_id', media_col: 'video_id' }, speaker: { junction: 'video_speakers', media_col: 'video_id' } },
  'video:sentence': { medium: 'video', media_table: 'videos', owner_table: 'sentences', owner_param: 'sentenceId', media_param: 'videoId', folder: 'videos', link: { kind: 'junction', table: 'sentence_videos', owner_col: 'sentence_id', media_col: 'video_id' }, speaker: { junction: 'video_speakers', media_col: 'video_id' } },
  'video:text': { medium: 'video', media_table: 'videos', owner_table: 'texts', owner_param: 'textId', media_param: 'videoId', folder: 'videos', link: { kind: 'column', column: 'text_id' }, speaker: { junction: 'video_speakers', media_col: 'video_id' } },
}

export interface MediaFieldInput {
  storage_path?: string | null
  serving_url?: string
  /** Audio/video: a `sources.slug` registry ref (strict). Photos: free-text caption/attribution. */
  source?: string | null
  photographer?: string | null
  videographer?: string | null
  hosted_elsewhere?: HostedVideo | null
  hosted_metadata?: HostedMetadata | null
  /** Audio: sentence id → compact word-timing string (see `MediaTimings`). */
  timings?: MediaTimings | null
}

export interface MediaRecord {
  id: string
  storage_path?: string | null
  serving_url?: string | null
  hosted_elsewhere?: HostedVideo | null
  hosted_metadata?: HostedMetadata | null
  source?: string | null
  photographer?: string | null
  videographer?: string | null
  timings?: MediaTimings | null
  /** Absolute URL that redirects to the stored bytes (audio; set by the route layer). */
  download_url?: string
  entry_id?: string | null
  sentence_id?: string | null
  text_id?: string | null
  speakers?: { id: string, name: string }[]
  created_at: string
  updated_at: string
}

export interface MediaAttachResult {
  /** Owner (entry/sense/sentence/text) exists. */
  found: boolean
  /** false = idempotent no-op (a supplied media id already existed). */
  created: boolean
  media?: MediaRecord
  new_synced_up_to: string | null
}

function prune(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (value !== undefined)
      out[key] = value
  }
  return out
}

function build_media_columns(cell: MediaCellConfig, fields: MediaFieldInput): Record<string, unknown> {
  if (cell.medium === 'audio')
    return { storage_path: fields.storage_path, source: fields.source ?? null, timings: fields.timings ?? null }
  if (cell.medium === 'photo')
    return { storage_path: fields.storage_path, serving_url: fields.serving_url, source: fields.source ?? null, photographer: fields.photographer ?? null }
  // video
  return { storage_path: fields.storage_path ?? null, hosted_elsewhere: fields.hosted_elsewhere ?? null, hosted_metadata: fields.hosted_metadata ?? null, source: fields.source ?? null, videographer: fields.videographer ?? null }
}

function existing_media_ids({ db, cell, owner_id }: { db: Database.Database, cell: MediaCellConfig, owner_id: string }): string[] {
  if (cell.link.kind === 'column') {
    const rows = db.prepare(`SELECT id FROM "${cell.media_table}" WHERE "${cell.link.column}" = ?`).all(owner_id) as { id: string }[]
    return rows.map(row => row.id)
  }
  const rows = db.prepare(`SELECT "${cell.link.media_col}" AS id FROM "${cell.link.table}" WHERE "${cell.link.owner_col}" = ?`).all(owner_id) as { id: string }[]
  return rows.map(row => row.id)
}

function read_speakers({ db, cell, media_id }: { db: Database.Database, cell: MediaCellConfig, media_id: string }): { id: string, name: string }[] {
  if (!cell.speaker)
    return []
  return db.prepare(
    `SELECT sp.id, sp.name FROM speakers sp
       JOIN "${cell.speaker.junction}" j ON j.speaker_id = sp.id
      WHERE j."${cell.speaker.media_col}" = ? ORDER BY sp.name`,
  ).all(media_id) as { id: string, name: string }[]
}

/** Read one media row in the public response shape (or `undefined` if gone). */
export function read_media_record({ db, cell_key, media_id }: { db: Database.Database, cell_key: MediaCellKey, media_id: string }): MediaRecord | undefined {
  const cell = MEDIA_CELLS[cell_key]
  const raw = db.prepare(`SELECT * FROM "${cell.media_table}" WHERE id = ?`).get(media_id) as Record<string, any> | undefined
  if (!raw)
    return undefined
  const row = parse_dict_row(cell.media_table, raw) as Record<string, any>
  const record: MediaRecord = { id: row.id, created_at: row.created_at, updated_at: row.updated_at }
  if (cell.medium === 'audio') {
    record.storage_path = row.storage_path
    record.source = row.source ?? null
    record.timings = (row.timings as MediaTimings) ?? null
    record.entry_id = row.entry_id ?? null
    record.sentence_id = row.sentence_id ?? null
    record.text_id = row.text_id ?? null
  } else if (cell.medium === 'photo') {
    record.storage_path = row.storage_path
    record.serving_url = row.serving_url
    record.source = row.source ?? null
    record.photographer = row.photographer ?? null
  } else {
    record.storage_path = row.storage_path ?? null
    record.hosted_elsewhere = (row.hosted_elsewhere as HostedVideo) ?? null
    record.hosted_metadata = (row.hosted_metadata as HostedMetadata) ?? null
    record.source = row.source ?? null
    record.videographer = row.videographer ?? null
    record.text_id = row.text_id ?? null
  }
  if (cell.speaker) {
    const speakers = read_speakers({ db, cell, media_id })
    if (speakers.length)
      record.speakers = speakers
  }
  return record
}

/**
 * Audio + video must carry attribution: a speaker and/or a sources-registry
 * slug in `source`. Photos are exempt — their `source` is free-text
 * caption/attribution prose, not a registry ref.
 */
export function media_requires_attribution(cell: MediaCellConfig): boolean {
  return cell.medium !== 'photo'
}

function commit_history(history_db: Database.Database | undefined, events: HistoryEvent[]): void {
  if (history_db && events.length) {
    try {
      record_history(history_db, events)
    } catch (err) {
      console.warn('Could not record v1 media history:', err)
    }
  }
}

/**
 * Attach one media item to its owner (create the media row + link, plus an
 * optional speaker junction) in ONE transaction. `media_id` makes it idempotent
 * (a re-POST of an existing id is a no-op, `created: false`); `replace` first
 * tombstones every existing media of this medium on this owner. Returns
 * `found: false` when the owner id doesn't exist. Throws on a missing speaker,
 * an unsupported speaker, missing attribution (audio/video need `speaker_id`
 * and/or a registry `source` slug), or an unknown source slug (route → 400).
 */
export function attach_media({ db, history_db, cell_key, owner_id, media_id, fields, speaker_id, replace, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  cell_key: MediaCellKey
  owner_id: string
  media_id?: string
  fields: MediaFieldInput
  speaker_id?: string
  replace?: boolean
  user_id: string
  api_key_id?: string | null
}): MediaAttachResult {
  const cell = MEDIA_CELLS[cell_key]

  if (!db.prepare(`SELECT 1 FROM "${cell.owner_table}" WHERE id = ?`).get(owner_id))
    return { found: false, created: false, new_synced_up_to: read_last_modified_at(db) }

  if (media_id && db.prepare(`SELECT 1 FROM "${cell.media_table}" WHERE id = ?`).get(media_id))
    return { found: true, created: false, media: read_media_record({ db, cell_key, media_id }), new_synced_up_to: read_last_modified_at(db) }

  if (speaker_id) {
    if (!cell.speaker)
      throw new Error(`${cell.medium} media does not support a speaker`)
    if (!db.prepare(`SELECT 1 FROM speakers WHERE id = ?`).get(speaker_id))
      throw new Error('speaker not found')
  }

  if (media_requires_attribution(cell)) {
    if (!speaker_id && !fields.source)
      throw new Error(`${cell.medium} requires attribution: provide speaker_id and/or source (a sources-registry slug)`)
    if (fields.source && !load_source_slug_set(db).has(fields.source))
      throw new Error(`unknown source slug '${fields.source}'; create it via POST /dictionaries/{id}/sources first`)
  }

  const new_media_id = media_id ?? crypto.randomUUID()
  const now = new Date().toISOString()
  const events: HistoryEvent[] = []
  const push = (table_name: DictSyncableTable, row: Record<string, unknown>) => {
    const event = merge_dict_row({ db, table_name, row, user_id, at: now, api_key_id })
    if (event)
      events.push(event)
  }

  db.exec('BEGIN IMMEDIATE')
  try {
    if (replace) {
      for (const existing_id of existing_media_ids({ db, cell, owner_id })) {
        const { event } = delete_dict_row({ db, table_name: cell.media_table, id: existing_id, user_id, at: now, api_key_id })
        if (event)
          events.push(event)
      }
    }

    const media_row: Record<string, unknown> = { id: new_media_id, ...build_media_columns(cell, fields), created_at: now, updated_at: now }
    if (cell.link.kind === 'column')
      media_row[cell.link.column] = owner_id
    push(cell.media_table, prune(media_row))

    if (cell.link.kind === 'junction')
      push(cell.link.table, { id: crypto.randomUUID(), [cell.link.owner_col]: owner_id, [cell.link.media_col]: new_media_id, created_at: now, updated_at: now })

    if (speaker_id && cell.speaker)
      push(cell.speaker.junction, { id: crypto.randomUUID(), [cell.speaker.media_col]: new_media_id, speaker_id, created_at: now, updated_at: now })

    const new_synced_up_to = read_last_modified_at(db)
    db.exec('COMMIT')
    commit_history(history_db, events)
    return { found: true, created: true, media: read_media_record({ db, cell_key, media_id: new_media_id }), new_synced_up_to }
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

/**
 * Delete one media item from an owner. Verifies the media is actually linked to
 * THIS owner (404 otherwise), then tombstone-deletes the media row (FK cascade
 * sweeps its junctions + speaker links) — matching a human editor's media delete.
 */
export function delete_media({ db, history_db, cell_key, owner_id, media_id, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  cell_key: MediaCellKey
  owner_id: string
  media_id: string
  user_id: string
  api_key_id?: string | null
}): SingleWriteResult {
  const cell = MEDIA_CELLS[cell_key]
  const linked = cell.link.kind === 'column'
    ? db.prepare(`SELECT 1 FROM "${cell.media_table}" WHERE id = ? AND "${cell.link.column}" = ?`).get(media_id, owner_id)
    : db.prepare(`SELECT 1 FROM "${cell.link.table}" WHERE "${cell.link.owner_col}" = ? AND "${cell.link.media_col}" = ?`).get(owner_id, media_id)
  if (!linked)
    return { found: false, new_synced_up_to: read_last_modified_at(db) }
  return run_tombstone_delete({ db, history_db, table_name: cell.media_table, id: media_id, user_id, api_key_id })
}

export interface MediaTimingsUpdateResult {
  found: boolean
  media?: MediaRecord
  new_synced_up_to: string | null
}

/**
 * Set / replace / clear (`null`) an audio row's `timings` — the post-upload
 * forced-alignment write-back path. Verifies the audio is linked to THIS owner
 * (found: false otherwise), then merges the single column through
 * `merge_dict_row` like any editor push.
 */
export function update_media_timings({ db, history_db, cell_key, owner_id, media_id, timings, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  cell_key: MediaCellKey
  owner_id: string
  media_id: string
  timings: MediaTimings | null
  user_id: string
  api_key_id?: string | null
}): MediaTimingsUpdateResult {
  const cell = MEDIA_CELLS[cell_key]
  if (cell.medium !== 'audio')
    throw new Error('timings are only stored on audio')
  const linked = cell.link.kind === 'column'
    ? db.prepare(`SELECT 1 FROM "${cell.media_table}" WHERE id = ? AND "${cell.link.column}" = ?`).get(media_id, owner_id)
    : db.prepare(`SELECT 1 FROM "${cell.link.table}" WHERE "${cell.link.owner_col}" = ? AND "${cell.link.media_col}" = ?`).get(owner_id, media_id)
  if (!linked)
    return { found: false, new_synced_up_to: read_last_modified_at(db) }

  const existing = parse_dict_row(cell.media_table, db.prepare(`SELECT * FROM "${cell.media_table}" WHERE id = ?`).get(media_id) as Record<string, unknown>)
  const now = new Date().toISOString()
  const row: Record<string, unknown> = { ...existing, timings, updated_at: now }
  delete row.updated_by_user_id

  db.exec('BEGIN IMMEDIATE')
  try {
    const event = merge_dict_row({ db, table_name: cell.media_table, row, user_id, at: now, api_key_id })
    const new_synced_up_to = read_last_modified_at(db)
    db.exec('COMMIT')
    commit_history(history_db, event ? [event] : [])
    return { found: true, media: read_media_record({ db, cell_key, media_id }), new_synced_up_to }
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}
