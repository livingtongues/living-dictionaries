import type Database from 'better-sqlite3'
import type { HistoryEvent } from './dictionary-history-db'
import type { DictSyncableTable } from '$lib/db/dict-syncable-tables'
import type { MultiString } from '$lib/types'
import { parse_dict_row } from '$lib/db/schemas/dictionary-json-columns'
import { read_last_modified_at } from './dictionary-db'
import { record_history } from './dictionary-history-db'
import { merge_dict_row } from './dictionary-sync-helpers'

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
