import type Database from 'better-sqlite3'
import type { HistoryEvent } from './dictionary-history-db'
import type { DictSyncableTable } from '$lib/db/dict-syncable-tables'
import type { EntriesWriteResponseBody, EntryInput, EntryPatch, EntryWriteResult, SenseInput, SentenceInput, SentencePatch } from '$lib/api/v1/entry-input'
import type { MultiString } from '$lib/types'
import { to_multistring, to_string_array } from '$lib/api/v1/entry-input'
import { parse_dict_row } from '$lib/db/schemas/dictionary-json-columns'
import { read_last_modified_at } from './dictionary-db'
import { record_history } from './dictionary-history-db'
import { delete_dict_row, merge_dict_row } from './dictionary-sync-helpers'

/**
 * Server-side bulk write for the `/api/v1` entries API.
 *
 * Translates the agent-facing nested {@link EntryInput} into dict.db rows and
 * applies them through `merge_dict_row` — the SAME path a browser editor push
 * uses — so audit stamping, the `last_modified_at` triggers (→ peers pull via
 * `/changes`), and change-history capture all behave identically to a human
 * edit.
 *
 * Per-item atomicity + best-effort batching (Q4): the whole call runs in ONE
 * transaction, but each entry's multi-table write is wrapped in a SAVEPOINT —
 * a bad row rolls back just that item and is reported in `failed`, the rest
 * commit. Dialects/tags are found-or-created (deduped by name); a new
 * dialect/tag created by a failed item is rolled back with it.
 */

interface BuiltRow {
  table_name: DictSyncableTable
  row: Record<string, unknown>
}

interface BuiltEntry {
  entry_id: string
  sense_ids: string[]
  ordered_rows: BuiltRow[]
  /** name-key → id for dialects newly created by this item (merged into the shared map on success). */
  new_dialects: Map<string, string>
  new_tags: Map<string, string>
}

function prune(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (value !== undefined)
      out[key] = value
  }
  return out
}

function name_key(name: string): string {
  return name.trim().toLowerCase()
}

function load_dialect_map(db: Database.Database): Map<string, string> {
  const map = new Map<string, string>()
  const rows = db.prepare(`SELECT id, name FROM dialects`).all() as { id: string, name: string }[]
  for (const { id, name } of rows) {
    let parsed: MultiString | undefined
    try {
      parsed = JSON.parse(name) as MultiString
    } catch {
      parsed = undefined
    }
    for (const value of Object.values(parsed ?? {})) {
      if (typeof value === 'string' && value.trim())
        map.set(name_key(value), id)
    }
  }
  return map
}

function load_tag_map(db: Database.Database): Map<string, string> {
  const map = new Map<string, string>()
  const rows = db.prepare(`SELECT id, name FROM tags`).all() as { id: string, name: string }[]
  for (const { id, name } of rows) {
    if (name?.trim())
      map.set(name_key(name), id)
  }
  return map
}

function build_sentence_rows({ sentence, sense_id, now }: { sentence: SentenceInput, sense_id: string, now: string }): BuiltRow[] | null {
  const text = to_multistring(sentence.text)
  const translation = to_multistring(sentence.translation)
  if (!text && !translation)
    return null
  const sentence_id = crypto.randomUUID()
  return [
    { table_name: 'sentences', row: prune({ id: sentence_id, text, translation, created_at: now, updated_at: now }) },
    { table_name: 'senses_in_sentences', row: prune({ id: crypto.randomUUID(), sense_id, sentence_id, created_at: now, updated_at: now }) },
  ]
}

function build_sense_rows({ sense, entry_id, now }: { sense: SenseInput, entry_id: string, now: string }): { sense_id: string, rows: BuiltRow[] } {
  const sense_id = crypto.randomUUID()
  const rows: BuiltRow[] = [{
    table_name: 'senses',
    row: prune({
      id: sense_id,
      entry_id,
      glosses: to_multistring(sense.glosses),
      definition: to_multistring(sense.definition),
      parts_of_speech: to_string_array(sense.parts_of_speech),
      semantic_domains: to_string_array(sense.semantic_domains),
      write_in_semantic_domains: to_string_array(sense.write_in_semantic_domains),
      noun_class: sense.noun_class?.trim() || undefined,
      plural_form: to_multistring(sense.plural_form),
      variant: to_multistring(sense.variant),
      created_at: now,
      updated_at: now,
    }),
  }]
  for (const sentence of sense.example_sentences ?? []) {
    const sentence_rows = build_sentence_rows({ sentence, sense_id, now })
    if (sentence_rows)
      rows.push(...sentence_rows)
  }
  return { sense_id, rows }
}

function build_entry({ entry, now, dialect_map, tag_map, import_tag_id }: {
  entry: EntryInput
  now: string
  dialect_map: Map<string, string>
  tag_map: Map<string, string>
  import_tag_id?: string
}): BuiltEntry {
  const lexeme = to_multistring(entry.lexeme)
  if (!lexeme)
    throw new Error('lexeme is required')

  const entry_id = crypto.randomUUID()
  const ordered_rows: BuiltRow[] = []
  const new_dialects = new Map<string, string>()
  const new_tags = new Map<string, string>()

  // Dialects + tags first so their ids exist before the junctions. New ones are
  // emitted ahead of the entry row (no FK dependency on the entry).
  const dialect_links: string[] = []
  for (const raw_name of to_string_array(entry.dialects) ?? []) {
    const key = name_key(raw_name)
    let id = dialect_map.get(key) ?? new_dialects.get(key)
    if (!id) {
      id = crypto.randomUUID()
      new_dialects.set(key, id)
      ordered_rows.push({ table_name: 'dialects', row: prune({ id, name: { default: raw_name.trim() }, created_at: now, updated_at: now }) })
    }
    dialect_links.push(id)
  }

  const tag_links: string[] = []
  for (const raw_name of to_string_array(entry.tags) ?? []) {
    const key = name_key(raw_name)
    let id = tag_map.get(key) ?? new_tags.get(key)
    if (!id) {
      id = crypto.randomUUID()
      new_tags.set(key, id)
      ordered_rows.push({ table_name: 'tags', row: prune({ id, name: raw_name.trim(), created_at: now, updated_at: now }) })
    }
    tag_links.push(id)
  }

  // Entry.
  ordered_rows.push({
    table_name: 'entries',
    row: prune({
      id: entry_id,
      lexeme,
      phonetic: entry.phonetic?.trim() || undefined,
      interlinearization: entry.interlinearization?.trim() || undefined,
      morphology: entry.morphology?.trim() || undefined,
      notes: to_multistring(entry.notes),
      linguistic_history: to_multistring(entry.linguistic_history),
      sources: to_string_array(entry.sources),
      scientific_names: to_string_array(entry.scientific_names),
      elicitation_id: entry.elicitation_id?.trim() || undefined,
      created_at: now,
      updated_at: now,
    }),
  })

  // Junctions (entry now exists).
  for (const dialect_id of dialect_links)
    ordered_rows.push({ table_name: 'entry_dialects', row: prune({ id: crypto.randomUUID(), entry_id, dialect_id, created_at: now, updated_at: now }) })
  for (const tag_id of tag_links)
    ordered_rows.push({ table_name: 'entry_tags', row: prune({ id: crypto.randomUUID(), entry_id, tag_id, created_at: now, updated_at: now }) })
  if (import_tag_id)
    ordered_rows.push({ table_name: 'entry_tags', row: prune({ id: crypto.randomUUID(), entry_id, tag_id: import_tag_id, created_at: now, updated_at: now }) })

  // Senses (default to one empty sense, mirroring the UI's new-entry shape).
  const senses = entry.senses?.length ? entry.senses : [{}]
  const sense_ids: string[] = []
  for (const sense of senses) {
    const { sense_id, rows } = build_sense_rows({ sense, entry_id, now })
    sense_ids.push(sense_id)
    ordered_rows.push(...rows)
  }

  return { entry_id, sense_ids, ordered_rows, new_dialects, new_tags }
}

/** Find-or-create a private tag for the import batch label. */
function ensure_import_tag({ db, import_id, tag_map, now, history_events, user_id, history_at, api_key_id }: {
  db: Database.Database
  import_id: string
  tag_map: Map<string, string>
  now: string
  history_events: HistoryEvent[]
  user_id: string
  history_at: string
  api_key_id?: string | null
}): string {
  const existing = tag_map.get(name_key(import_id))
  if (existing)
    return existing
  const id = crypto.randomUUID()
  const event = merge_dict_row({ db, table_name: 'tags', row: prune({ id, name: import_id.trim(), private: 1, created_at: now, updated_at: now }), user_id, at: history_at, api_key_id })
  if (event)
    history_events.push(event)
  tag_map.set(name_key(import_id), id)
  return id
}

export interface ApplyEntryWritesResult extends EntriesWriteResponseBody {
  /** Post-write cursor (db_metadata.last_modified_at) for the shared.db mirror. */
  new_synced_up_to: string | null
}

export function apply_entry_writes({ db, history_db, entries, user_id, import_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  entries: EntryInput[]
  user_id: string
  import_id?: string
  /** Acting agent's API key id (when written via an `ldk_` key); null for human edits. */
  api_key_id?: string | null
}): ApplyEntryWritesResult {
  const now = new Date().toISOString()
  const history_at = now
  const history_events: HistoryEvent[] = []
  const dialect_map = load_dialect_map(db)
  const tag_map = load_tag_map(db)

  const results: EntryWriteResult[] = []
  let created = 0
  let failed = 0

  db.exec('BEGIN IMMEDIATE')
  try {
    const import_tag_id = import_id
      ? ensure_import_tag({ db, import_id, tag_map, now, history_events, user_id, history_at, api_key_id })
      : undefined

    for (const entry of entries) {
      db.exec('SAVEPOINT v1_item')
      // Buffer this item's history events locally — only merge them into the
      // shared list AFTER the item commits (RELEASE). A later-row failure does
      // `ROLLBACK TO v1_item`, undoing the item's DB rows; staging straight into
      // `history_events` would leave phantom change rows for an entry that never
      // committed (the earlier rows' events outlive the rollback).
      const item_history: HistoryEvent[] = []
      try {
        const built = build_entry({ entry, now, dialect_map, tag_map, import_tag_id })
        for (const { table_name, row } of built.ordered_rows) {
          const event = merge_dict_row({ db, table_name, row, user_id, at: history_at, api_key_id })
          if (event)
            item_history.push(event)
        }
        db.exec('RELEASE v1_item')
        history_events.push(...item_history)
        for (const [key, id] of built.new_dialects)
          dialect_map.set(key, id)
        for (const [key, id] of built.new_tags)
          tag_map.set(key, id)
        results.push({ external_id: entry.external_id, status: 'created', entry_id: built.entry_id, sense_ids: built.sense_ids })
        created++
      } catch (err) {
        db.exec('ROLLBACK TO v1_item')
        db.exec('RELEASE v1_item')
        // item_history is discarded with the rolled-back rows.
        results.push({ external_id: entry.external_id, status: 'failed', error: (err as Error).message })
        failed++
      }
    }

    const new_synced_up_to = read_last_modified_at(db)
    db.exec('COMMIT')

    if (history_db && history_events.length) {
      try {
        record_history(history_db, history_events)
      } catch (err) {
        console.warn('Could not record v1 write history:', err)
      }
    }

    return { created, updated: 0, failed, results, new_synced_up_to }
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

// ── Update (PATCH) ──────────────────────────────────────────────────────────

const ENTRY_PATCH_TEXT_FIELDS = ['phonetic', 'interlinearization', 'morphology', 'elicitation_id'] as const
const ENTRY_PATCH_MULTISTRING_FIELDS = ['notes', 'linguistic_history'] as const
const ENTRY_PATCH_ARRAY_FIELDS = ['sources', 'scientific_names'] as const
const SENSE_PATCH_TEXT_FIELDS = ['noun_class'] as const
const SENSE_PATCH_MULTISTRING_FIELDS = ['glosses', 'definition', 'plural_form', 'variant'] as const
const SENSE_PATCH_ARRAY_FIELDS = ['parts_of_speech', 'semantic_domains', 'write_in_semantic_domains'] as const

function read_parsed_row({ db, table, id }: { db: Database.Database, table: string, id: string }): Record<string, unknown> | undefined {
  const row = db.prepare(`SELECT * FROM "${table}" WHERE id = ?`).get(id) as Record<string, unknown> | undefined
  return row ? parse_dict_row(table, row) : undefined
}

/**
 * Overlay a patch onto the EXISTING parsed entry row → a full row for
 * `merge_dict_row` (which does INSERT…ON CONFLICT, so it needs every NOT NULL
 * column). Returns `null` when the patch touches no entry-level field.
 */
function build_entry_patch_row({ existing, patch, now }: { existing: Record<string, unknown>, patch: EntryPatch, now: string }): Record<string, unknown> | null {
  const source = patch as Record<string, unknown>
  const row: Record<string, unknown> = { ...existing, updated_at: now }
  delete row.updated_by_user_id // let merge_dict_row re-stamp the current editor
  let changed = false
  if ('lexeme' in source) {
    const lexeme = to_multistring(patch.lexeme)
    if (!lexeme)
      throw new Error('lexeme cannot be empty')
    row.lexeme = lexeme
    changed = true
  }
  for (const field of ENTRY_PATCH_TEXT_FIELDS) {
    if (field in source) {
      row[field] = (source[field] as string | undefined)?.trim() || null
      changed = true
    }
  }
  for (const field of ENTRY_PATCH_MULTISTRING_FIELDS) {
    if (field in source) {
      row[field] = to_multistring(source[field]) ?? null
      changed = true
    }
  }
  for (const field of ENTRY_PATCH_ARRAY_FIELDS) {
    if (field in source) {
      row[field] = to_string_array(source[field]) ?? null
      changed = true
    }
  }
  return changed ? row : null
}

function build_sense_patch_row({ existing, sense, now }: { existing: Record<string, unknown>, sense: SenseInput, now: string }): Record<string, unknown> | null {
  const source = sense as Record<string, unknown>
  const row: Record<string, unknown> = { ...existing, updated_at: now }
  delete row.updated_by_user_id // let merge_dict_row re-stamp the current editor
  let changed = false
  for (const field of SENSE_PATCH_TEXT_FIELDS) {
    if (field in source) {
      row[field] = (source[field] as string | undefined)?.trim() || null
      changed = true
    }
  }
  for (const field of SENSE_PATCH_MULTISTRING_FIELDS) {
    if (field in source) {
      row[field] = to_multistring(source[field]) ?? null
      changed = true
    }
  }
  for (const field of SENSE_PATCH_ARRAY_FIELDS) {
    if (field in source) {
      row[field] = to_string_array(source[field]) ?? null
      changed = true
    }
  }
  return changed ? row : null
}

export interface SingleEntryWriteResult {
  found: boolean
  entry_id: string
  new_synced_up_to: string | null
}

/**
 * Field-merge an existing entry (PATCH). Provided entry/sense scalar+JSON fields
 * overwrite; omitted ones are untouched. `senses` upsert by id (no id → create);
 * example sentences without an id are appended. `dialects`/`tags` are additive
 * links (found-or-created, deduped). Returns `found: false` if the entry is gone.
 */
export function apply_entry_update({ db, history_db, entry_id, patch, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  entry_id: string
  patch: EntryPatch
  user_id: string
  /** Acting agent's API key id (when written via an `ldk_` key); null for human edits. */
  api_key_id?: string | null
}): SingleEntryWriteResult {
  const existing_entry = read_parsed_row({ db, table: 'entries', id: entry_id })
  if (!existing_entry)
    return { found: false, entry_id, new_synced_up_to: read_last_modified_at(db) }

  const now = new Date().toISOString()
  const history_events: HistoryEvent[] = []
  const dialect_map = load_dialect_map(db)
  const tag_map = load_tag_map(db)
  const push = (table_name: DictSyncableTable, row: Record<string, unknown>) => {
    const event = merge_dict_row({ db, table_name, row, user_id, at: now, api_key_id })
    if (event)
      history_events.push(event)
  }

  db.exec('BEGIN IMMEDIATE')
  try {
    const entry_row = build_entry_patch_row({ existing: existing_entry, patch, now })
    if (entry_row)
      push('entries', entry_row)

    for (const sense of patch.senses ?? []) {
      if (sense.id) {
        const existing_sense = read_parsed_row({ db, table: 'senses', id: sense.id })
        if (!existing_sense || existing_sense.entry_id !== entry_id)
          throw new Error(`sense ${sense.id} not found on this entry`)
        const sense_row = build_sense_patch_row({ existing: existing_sense, sense, now })
        if (sense_row)
          push('senses', sense_row)
        for (const sentence of sense.example_sentences ?? []) {
          for (const built of build_sentence_rows({ sentence, sense_id: sense.id, now }) ?? [])
            push(built.table_name, built.row)
        }
      } else {
        const built = build_sense_rows({ sense, entry_id, now })
        for (const row of built.rows)
          push(row.table_name, row.row)
      }
    }

    const linked_dialects = new Set((db.prepare(`SELECT dialect_id FROM entry_dialects WHERE entry_id = ?`).all(entry_id) as { dialect_id: string }[]).map(r => r.dialect_id))
    for (const raw of to_string_array(patch.dialects) ?? []) {
      const key = name_key(raw)
      let id = dialect_map.get(key)
      if (!id) {
        id = crypto.randomUUID()
        dialect_map.set(key, id)
        push('dialects', prune({ id, name: { default: raw.trim() }, created_at: now, updated_at: now }))
      }
      if (!linked_dialects.has(id)) {
        push('entry_dialects', prune({ id: crypto.randomUUID(), entry_id, dialect_id: id, created_at: now, updated_at: now }))
        linked_dialects.add(id)
      }
    }

    const linked_tags = new Set((db.prepare(`SELECT tag_id FROM entry_tags WHERE entry_id = ?`).all(entry_id) as { tag_id: string }[]).map(r => r.tag_id))
    for (const raw of to_string_array(patch.tags) ?? []) {
      const key = name_key(raw)
      let id = tag_map.get(key)
      if (!id) {
        id = crypto.randomUUID()
        tag_map.set(key, id)
        push('tags', prune({ id, name: raw.trim(), created_at: now, updated_at: now }))
      }
      if (!linked_tags.has(id)) {
        push('entry_tags', prune({ id: crypto.randomUUID(), entry_id, tag_id: id, created_at: now, updated_at: now }))
        linked_tags.add(id)
      }
    }

    const new_synced_up_to = read_last_modified_at(db)
    db.exec('COMMIT')
    if (history_db && history_events.length) {
      try {
        record_history(history_db, history_events)
      } catch (err) {
        console.warn('Could not record v1 update history:', err)
      }
    }
    return { found: true, entry_id, new_synced_up_to }
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

// ── Delete (shared tombstone runner) ──────────────────────────────────────────

export interface SingleWriteResult {
  found: boolean
  new_synced_up_to: string | null
}

/**
 * Tombstone-delete ONE row in its own transaction (the v1 write path's wrapper
 * around {@link delete_dict_row}): captures the before-image + owners, fires the
 * cascade, advances the cursor, and records the `delete` history event. Returns
 * `found: false` (no commit) when the row is already gone. Used by every v1
 * delete/unlink endpoint so they all behave like a human editor delete.
 */
export function run_tombstone_delete({ db, history_db, table_name, id, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  table_name: DictSyncableTable
  id: string
  user_id: string
  api_key_id?: string | null
}): SingleWriteResult {
  const now = new Date().toISOString()
  db.exec('BEGIN IMMEDIATE')
  try {
    const { deleted, event } = delete_dict_row({ db, table_name, id, user_id, at: now, api_key_id })
    if (!deleted) {
      db.exec('ROLLBACK')
      return { found: false, new_synced_up_to: read_last_modified_at(db) }
    }
    const new_synced_up_to = read_last_modified_at(db)
    db.exec('COMMIT')
    if (history_db && event) {
      try {
        record_history(history_db, [event])
      } catch (err) {
        console.warn(`Could not record v1 ${table_name} delete history:`, err)
      }
    }
    return { found: true, new_synced_up_to }
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

/**
 * Hard-delete an entry via a `deletes` tombstone — fires `process_delete_cascade`
 * (DELETEs the entry + FK-cascades senses/sentences/junctions), advances the sync
 * cursor, and is logged to peers exactly like an editor's delete. Records a
 * `delete` history event for the entry. Returns `found: false` if already gone.
 */
export function apply_entry_delete({ db, history_db, entry_id, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  entry_id: string
  user_id: string
  /** Acting agent's API key id (when written via an `ldk_` key); null for human edits. */
  api_key_id?: string | null
}): SingleEntryWriteResult {
  const { found, new_synced_up_to } = run_tombstone_delete({ db, history_db, table_name: 'entries', id: entry_id, user_id, api_key_id })
  return { found, entry_id, new_synced_up_to }
}

// ── Sentence update / delete ──────────────────────────────────────────────────

export interface SentenceRecord {
  id: string
  text: MultiString | null
  translation: MultiString | null
  text_id: string | null
  sort_key: string | null
  ends_paragraph: number | null
  updated_at: string
}

/** Read one example sentence in the public READ shape (or `undefined` if gone). */
export function read_sentence_record(db: Database.Database, sentence_id: string): SentenceRecord | undefined {
  const row = read_parsed_row({ db, table: 'sentences', id: sentence_id })
  if (!row)
    return undefined
  return {
    id: row.id as string,
    text: (row.text as MultiString) ?? null,
    translation: (row.translation as MultiString) ?? null,
    text_id: (row.text_id as string) ?? null,
    sort_key: (row.sort_key as string) ?? null,
    ends_paragraph: (row.ends_paragraph as number) ?? null,
    updated_at: row.updated_at as string,
  }
}

/**
 * Field-merge an example sentence (`PATCH …/sentences/{id}`): provided `text` /
 * `translation` overwrite, omitted ones stay. Returns `found: false` if the
 * sentence id doesn't exist.
 */
export function apply_sentence_update({ db, history_db, sentence_id, patch, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  sentence_id: string
  patch: SentencePatch
  user_id: string
  api_key_id?: string | null
}): SingleWriteResult {
  const existing = read_parsed_row({ db, table: 'sentences', id: sentence_id })
  if (!existing)
    return { found: false, new_synced_up_to: read_last_modified_at(db) }

  const now = new Date().toISOString()
  const source = patch as Record<string, unknown>
  const row: Record<string, unknown> = { ...existing, updated_at: now }
  delete row.updated_by_user_id
  let changed = false
  if ('text' in source) {
    row.text = to_multistring(patch.text) ?? null
    changed = true
  }
  if ('translation' in source) {
    row.translation = to_multistring(patch.translation) ?? null
    changed = true
  }
  if (!changed)
    return { found: true, new_synced_up_to: read_last_modified_at(db) }

  db.exec('BEGIN IMMEDIATE')
  try {
    const event = merge_dict_row({ db, table_name: 'sentences', row, user_id, at: now, api_key_id })
    const new_synced_up_to = read_last_modified_at(db)
    db.exec('COMMIT')
    if (history_db && event) {
      try {
        record_history(history_db, [event])
      } catch (err) {
        console.warn('Could not record v1 sentence update history:', err)
      }
    }
    return { found: true, new_synced_up_to }
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

/** Delete one example sentence (the FK cascade sweeps its `senses_in_sentences` junctions). */
export function apply_sentence_delete({ db, history_db, sentence_id, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  sentence_id: string
  user_id: string
  api_key_id?: string | null
}): SingleWriteResult {
  return run_tombstone_delete({ db, history_db, table_name: 'sentences', id: sentence_id, user_id, api_key_id })
}

// ── Sense delete ──────────────────────────────────────────────────────────────

/**
 * Delete one sense (the FK cascade sweeps its `senses_in_sentences` junctions +
 * media links). Refuses to delete an entry's LAST sense — an entry must keep at
 * least one — throwing so the route can 400 ("delete the entry instead").
 * Returns `found: false` if the sense id doesn't exist.
 */
export function apply_sense_delete({ db, history_db, sense_id, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  sense_id: string
  user_id: string
  api_key_id?: string | null
}): SingleWriteResult {
  const sense = db.prepare(`SELECT entry_id FROM senses WHERE id = ?`).get(sense_id) as { entry_id: string } | undefined
  if (!sense)
    return { found: false, new_synced_up_to: read_last_modified_at(db) }
  const sibling_count = (db.prepare(`SELECT COUNT(*) AS c FROM senses WHERE entry_id = ?`).get(sense.entry_id) as { c: number }).c
  if (sibling_count <= 1)
    throw new Error('cannot delete the only sense of an entry; delete the entry instead')
  return run_tombstone_delete({ db, history_db, table_name: 'senses', id: sense_id, user_id, api_key_id })
}
