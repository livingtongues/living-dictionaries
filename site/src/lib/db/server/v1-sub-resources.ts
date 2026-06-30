import type Database from 'better-sqlite3'
import type { HistoryEvent } from './dictionary-history-db'
import type { SingleWriteResult } from './v1-entry-write'
import type { DictSyncableTable } from '$lib/db/dict-syncable-tables'
import type { MultiString } from '$lib/types'
import { to_multistring } from '$lib/api/v1/entry-input'
import { parse_dict_row } from '$lib/db/schemas/dictionary-json-columns'
import { read_last_modified_at } from './dictionary-db'
import { record_history } from './dictionary-history-db'
import { merge_dict_row } from './dictionary-sync-helpers'
import { run_tombstone_delete } from './v1-entry-write'

/**
 * `/api/v1` sub-resources: speakers (create/list) + tags/dialects (find-or-create
 * /list). Single-row writes go through `merge_dict_row` (same path + history as a
 * browser push). Tags/dialects dedupe by case-insensitive name.
 */

function name_key(name: string): string {
  return name.trim().toLowerCase()
}

function insert_row({ db, table, row, user_id }: { db: Database.Database, table: DictSyncableTable, row: Record<string, unknown>, user_id: string }): { cursor: string | null, event: HistoryEvent | null } {
  const now = new Date().toISOString()
  const event = merge_dict_row({ db, table_name: table, row: { ...row, created_at: now, updated_at: now }, user_id, at: now })
  return { cursor: read_last_modified_at(db), event }
}

function commit_history(history_db: Database.Database | undefined, event: HistoryEvent | null) {
  if (history_db && event) {
    try {
      record_history(history_db, [event])
    } catch (err) {
      console.warn('Could not record v1 sub-resource history:', err)
    }
  }
}

// ── Speakers ────────────────────────────────────────────────────────────────

export interface SpeakerRecord {
  id: string
  name: string
  decade: number | null
  gender: 'm' | 'f' | 'o' | null
  birthplace: string | null
}

export function list_speakers(db: Database.Database): SpeakerRecord[] {
  return db.prepare(`SELECT id, name, decade, gender, birthplace FROM speakers ORDER BY name`).all() as SpeakerRecord[]
}

export function create_speaker({ db, history_db, user_id, input }: {
  db: Database.Database
  history_db?: Database.Database
  user_id: string
  input: { name: string, decade?: number, gender?: 'm' | 'f' | 'o', birthplace?: string }
}): { speaker: SpeakerRecord, cursor: string | null } {
  const name = (input.name || '').trim()
  if (!name)
    throw new Error('speaker name is required')
  const id = crypto.randomUUID()
  const { cursor, event } = insert_row({ db, table: 'speakers', user_id, row: {
    id,
    name,
    decade: input.decade ?? null,
    gender: input.gender ?? null,
    birthplace: input.birthplace?.trim() || null,
  } })
  commit_history(history_db, event)
  return { speaker: { id, name, decade: input.decade ?? null, gender: input.gender ?? null, birthplace: input.birthplace?.trim() || null }, cursor }
}

// ── Tags ──────────────────────────────────────────────────────────────────

export interface TagRecord { id: string, name: string, private: number | null }

export function list_tags(db: Database.Database): TagRecord[] {
  return db.prepare(`SELECT id, name, private FROM tags ORDER BY name`).all() as TagRecord[]
}

export function find_or_create_tag({ db, history_db, user_id, name, is_private }: {
  db: Database.Database
  history_db?: Database.Database
  user_id: string
  name: string
  is_private?: boolean
}): { tag: TagRecord, created: boolean, cursor: string | null } {
  const trimmed = (name || '').trim()
  if (!trimmed)
    throw new Error('tag name is required')
  const existing = (list_tags(db)).find(tag => name_key(tag.name) === name_key(trimmed))
  if (existing)
    return { tag: existing, created: false, cursor: read_last_modified_at(db) }
  const id = crypto.randomUUID()
  const tag: TagRecord = { id, name: trimmed, private: is_private ? 1 : null }
  const { cursor, event } = insert_row({ db, table: 'tags', user_id, row: { id, name: trimmed, private: tag.private } })
  commit_history(history_db, event)
  return { tag, created: true, cursor }
}

// ── Dialects ────────────────────────────────────────────────────────────────

export interface DialectRecord { id: string, name: MultiString }

export function list_dialects(db: Database.Database): DialectRecord[] {
  const rows = db.prepare(`SELECT id, name FROM dialects ORDER BY name`).all() as { id: string, name: string }[]
  return rows.map(row => parse_dict_row('dialects', row) as unknown as DialectRecord)
}

export function find_or_create_dialect({ db, history_db, user_id, name }: {
  db: Database.Database
  history_db?: Database.Database
  user_id: string
  name: string
}): { dialect: DialectRecord, created: boolean, cursor: string | null } {
  const trimmed = (name || '').trim()
  if (!trimmed)
    throw new Error('dialect name is required')
  const existing = list_dialects(db).find(dialect => Object.values(dialect.name ?? {}).some(value => name_key(value) === name_key(trimmed)))
  if (existing)
    return { dialect: existing, created: false, cursor: read_last_modified_at(db) }
  const id = crypto.randomUUID()
  const dialect: DialectRecord = { id, name: { default: trimmed } }
  const { cursor, event } = insert_row({ db, table: 'dialects', user_id, row: { id, name: dialect.name } })
  commit_history(history_db, event)
  return { dialect, created: true, cursor }
}

// ── Tag / dialect update + delete + entry-unlink ──────────────────────────────

/**
 * Rename a tag and/or flip its `private` flag (`PATCH …/tags/{id}`). Affects
 * EVERY entry linked to the tag. Rejects a rename that would collide with another
 * tag's name. Returns `found: false` if the tag id doesn't exist.
 */
export function apply_tag_update({ db, history_db, tag_id, name, is_private, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  tag_id: string
  name?: string
  is_private?: boolean
  user_id: string
  api_key_id?: string | null
}): SingleWriteResult {
  const existing = db.prepare(`SELECT * FROM tags WHERE id = ?`).get(tag_id) as Record<string, unknown> | undefined
  if (!existing)
    return { found: false, new_synced_up_to: read_last_modified_at(db) }

  const now = new Date().toISOString()
  const row: Record<string, unknown> = { ...existing, updated_at: now }
  delete row.updated_by_user_id
  let changed = false
  if (name !== undefined) {
    const trimmed = name.trim()
    if (!trimmed)
      throw new Error('tag name cannot be empty')
    if (list_tags(db).some(tag => tag.id !== tag_id && name_key(tag.name) === name_key(trimmed)))
      throw new Error('another tag already has that name')
    row.name = trimmed
    changed = true
  }
  if (is_private !== undefined) {
    row.private = is_private ? 1 : null
    changed = true
  }
  if (!changed)
    return { found: true, new_synced_up_to: read_last_modified_at(db) }

  const event = merge_dict_row({ db, table_name: 'tags', row, user_id, at: now, api_key_id })
  commit_history(history_db, event)
  return { found: true, new_synced_up_to: read_last_modified_at(db) }
}

/** Delete a tag globally (the FK cascade unlinks it from every entry). */
export function apply_tag_delete({ db, history_db, tag_id, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  tag_id: string
  user_id: string
  api_key_id?: string | null
}): SingleWriteResult {
  return run_tombstone_delete({ db, history_db, table_name: 'tags', id: tag_id, user_id, api_key_id })
}

/**
 * Rename a dialect (`PATCH …/dialects/{id}`); accepts a plain string or a
 * locale-keyed map. Affects every entry linked to the dialect. Rejects a name
 * that collides with another dialect. Returns `found: false` if absent.
 */
export function apply_dialect_update({ db, history_db, dialect_id, name, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  dialect_id: string
  name?: MultiString | string
  user_id: string
  api_key_id?: string | null
}): SingleWriteResult {
  const existing = db.prepare(`SELECT * FROM dialects WHERE id = ?`).get(dialect_id) as Record<string, unknown> | undefined
  if (!existing)
    return { found: false, new_synced_up_to: read_last_modified_at(db) }
  if (name === undefined)
    return { found: true, new_synced_up_to: read_last_modified_at(db) }
  const value = to_multistring(name)
  if (!value)
    throw new Error('dialect name cannot be empty')
  const collides = list_dialects(db).some(dialect => dialect.id !== dialect_id
    && Object.values(dialect.name ?? {}).some(existing_value => Object.values(value).some(new_value => name_key(existing_value) === name_key(new_value))))
  if (collides)
    throw new Error('another dialect already has that name')

  const now = new Date().toISOString()
  const row: Record<string, unknown> = { ...existing, name: value, updated_at: now }
  delete row.updated_by_user_id
  const event = merge_dict_row({ db, table_name: 'dialects', row, user_id, at: now, api_key_id })
  commit_history(history_db, event)
  return { found: true, new_synced_up_to: read_last_modified_at(db) }
}

/** Delete a dialect globally (the FK cascade unlinks it from every entry). */
export function apply_dialect_delete({ db, history_db, dialect_id, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  dialect_id: string
  user_id: string
  api_key_id?: string | null
}): SingleWriteResult {
  return run_tombstone_delete({ db, history_db, table_name: 'dialects', id: dialect_id, user_id, api_key_id })
}

/** Unlink ONE tag from ONE entry (the tag itself, and its other links, survive). */
export function unlink_entry_tag({ db, history_db, entry_id, tag_id, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  entry_id: string
  tag_id: string
  user_id: string
  api_key_id?: string | null
}): SingleWriteResult {
  const junction = db.prepare(`SELECT id FROM entry_tags WHERE entry_id = ? AND tag_id = ?`).get(entry_id, tag_id) as { id: string } | undefined
  if (!junction)
    return { found: false, new_synced_up_to: read_last_modified_at(db) }
  return run_tombstone_delete({ db, history_db, table_name: 'entry_tags', id: junction.id, user_id, api_key_id })
}

/** Unlink ONE dialect from ONE entry (the dialect itself survives). */
export function unlink_entry_dialect({ db, history_db, entry_id, dialect_id, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  entry_id: string
  dialect_id: string
  user_id: string
  api_key_id?: string | null
}): SingleWriteResult {
  const junction = db.prepare(`SELECT id FROM entry_dialects WHERE entry_id = ? AND dialect_id = ?`).get(entry_id, dialect_id) as { id: string } | undefined
  if (!junction)
    return { found: false, new_synced_up_to: read_last_modified_at(db) }
  return run_tombstone_delete({ db, history_db, table_name: 'entry_dialects', id: junction.id, user_id, api_key_id })
}
