import type Database from 'better-sqlite3'
import type { HistoryEvent } from './dictionary-history-db'
import type { SingleWriteResult } from './v1-entry-write'
import type { DictSyncableTable } from '$lib/db/dict-syncable-tables'
import type { MultiString } from '$lib/types'
import { resolve_client_id, to_multistring } from '$lib/api/v1/entry-input'
import { key_between } from '$lib/api/v1/fractional-index'
import { parse_dict_row } from '$lib/db/schemas/dictionary-json-columns'
import { read_last_modified_at } from './dictionary-db'
import { record_history } from './dictionary-history-db'
import { merge_dict_row } from './dictionary-sync-helpers'
import { run_tombstone_delete } from './v1-entry-write'

/**
 * `/api/v1` STRUCTURED GRAMMAR surface — the shared server module backing both
 * the agent API and (later) the human editing UI. Everything lives in
 * `dictionaries/{id}.db`; writes go through `merge_dict_row` (same path + history
 * as a browser push). Covers: the `grammar_sections` tree, the section↔sentence
 * example junction, `clause_slots`, `glossing_abbreviations`, and the reverse
 * entry→grammar lookup. See .issues/structured-grammar.md.
 */

function commit_history(history_db: Database.Database | undefined, events: HistoryEvent[]) {
  if (history_db && events.length) {
    try {
      record_history(history_db, events)
    } catch (err) {
      console.warn('Could not record v1 grammar history:', err)
    }
  }
}

function row_exists(db: Database.Database, table: DictSyncableTable, id: string): boolean {
  return !!db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(id)
}

// ── Grammar sections ──────────────────────────────────────────────────────────

export interface GrammarSectionInput {
  id?: string
  parent_id?: string | null
  after_section_id?: string
  number_label?: string
  /** Optional — a section may be headless (body-only). At least one of `title`/`body` is required. */
  title?: MultiString | string
  body?: MultiString | string
  usage_conditions?: MultiString | string
  slot_id?: string | null
  entry_id?: string | null
  sense_id?: string | null
  example_sentence_ids?: string[]
}

export interface GrammarSectionPatch {
  parent_id?: string | null
  after_section_id?: string
  number_label?: string | null
  title?: MultiString | string
  body?: MultiString | string | null
  usage_conditions?: MultiString | string | null
  slot_id?: string | null
  entry_id?: string | null
  sense_id?: string | null
}

export interface SectionSentenceRef {
  id: string
  sentence_id: string
  sort_key: string | null
}

export interface GrammarSectionRecord {
  id: string
  parent_id: string | null
  sort_key: string | null
  number_label: string | null
  title: MultiString
  body: MultiString | null
  usage_conditions: MultiString | null
  slot_id: string | null
  entry_id: string | null
  sense_id: string | null
  example_sentences: SectionSentenceRef[]
  child_ids: string[]
  updated_at: string
}

/**
 * Fractional sort_key placing a section among its siblings (same `parent_id`).
 * `after_section_id` → between that sibling and the next; omitted → append.
 */
function sibling_sort_key({ db, parent_id, after_section_id, exclude_id }: {
  db: Database.Database
  parent_id: string | null
  after_section_id?: string
  exclude_id?: string
}): string {
  const siblings = (db.prepare(`SELECT id, sort_key FROM grammar_sections WHERE parent_id IS ? ORDER BY sort_key ASC, created_at ASC`).all(parent_id) as { id: string, sort_key: string | null }[])
    .filter(s => s.id !== exclude_id)
  if (after_section_id) {
    const index = siblings.findIndex(s => s.id === after_section_id)
    if (index === -1)
      throw new Error(`after_section_id '${after_section_id}' is not a sibling under this parent`)
    return key_between(siblings[index].sort_key, siblings[index + 1]?.sort_key ?? null)
  }
  return key_between(siblings[siblings.length - 1]?.sort_key ?? null, null)
}

function assert_section_refs({ db, parent_id, slot_id, entry_id, sense_id, self_id }: {
  db: Database.Database
  parent_id?: string | null
  slot_id?: string | null
  entry_id?: string | null
  sense_id?: string | null
  self_id?: string
}) {
  if (parent_id) {
    if (parent_id === self_id)
      throw new Error('a section cannot be its own parent')
    if (!row_exists(db, 'grammar_sections', parent_id))
      throw new Error(`parent section '${parent_id}' not found`)
  }
  if (slot_id && !row_exists(db, 'clause_slots', slot_id))
    throw new Error(`clause slot '${slot_id}' not found`)
  if (entry_id && !row_exists(db, 'entries', entry_id))
    throw new Error(`entry '${entry_id}' not found`)
  if (sense_id && !row_exists(db, 'senses', sense_id))
    throw new Error(`sense '${sense_id}' not found`)
}

function read_section_sentences(db: Database.Database, section_id: string): SectionSentenceRef[] {
  return db.prepare(`SELECT id, sentence_id, sort_key FROM section_sentences WHERE section_id = ? ORDER BY sort_key ASC, created_at ASC`).all(section_id) as SectionSentenceRef[]
}

function section_from_row(db: Database.Database, raw: Record<string, unknown>): GrammarSectionRecord {
  const parsed = parse_dict_row('grammar_sections', raw)
  const id = parsed.id as string
  const child_ids = (db.prepare(`SELECT id FROM grammar_sections WHERE parent_id = ? ORDER BY sort_key ASC, created_at ASC`).all(id) as { id: string }[]).map(r => r.id)
  return {
    id,
    parent_id: (parsed.parent_id as string) ?? null,
    sort_key: (parsed.sort_key as string) ?? null,
    number_label: (parsed.number_label as string) ?? null,
    title: (parsed.title as MultiString) ?? {},
    body: (parsed.body as MultiString) ?? null,
    usage_conditions: (parsed.usage_conditions as MultiString) ?? null,
    slot_id: (parsed.slot_id as string) ?? null,
    entry_id: (parsed.entry_id as string) ?? null,
    sense_id: (parsed.sense_id as string) ?? null,
    example_sentences: read_section_sentences(db, id),
    child_ids,
    updated_at: parsed.updated_at as string,
  }
}

export function get_section(db: Database.Database, section_id: string): GrammarSectionRecord | undefined {
  const raw = db.prepare(`SELECT * FROM grammar_sections WHERE id = ?`).get(section_id) as Record<string, unknown> | undefined
  return raw ? section_from_row(db, raw) : undefined
}

/** All sections (whole tree, ordered), or filtered by `parent_id` / `entry_id`. */
export function list_sections(db: Database.Database, filter: { parent_id?: string, entry_id?: string } = {}): GrammarSectionRecord[] {
  let sql = `SELECT * FROM grammar_sections`
  const where: string[] = []
  const params: unknown[] = []
  if (filter.parent_id !== undefined) { where.push(`parent_id IS ?`); params.push(filter.parent_id || null) }
  if (filter.entry_id !== undefined) { where.push(`entry_id = ?`); params.push(filter.entry_id) }
  if (where.length) sql += ` WHERE ${where.join(' AND ')}`
  sql += ` ORDER BY sort_key ASC, created_at ASC`
  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[]
  return rows.map(raw => section_from_row(db, raw))
}

/** Sections documenting this entry (its `entry_id`, or a `sense_id` of the entry) — the reverse link. */
export function list_entry_grammar_sections(db: Database.Database, entry_id: string): GrammarSectionRecord[] {
  const rows = db.prepare(
    `SELECT * FROM grammar_sections
     WHERE entry_id = ? OR sense_id IN (SELECT id FROM senses WHERE entry_id = ?)
     ORDER BY sort_key ASC, created_at ASC`,
  ).all(entry_id, entry_id) as Record<string, unknown>[]
  return rows.map(raw => section_from_row(db, raw))
}

/** Append a section↔sentence link inside an open transaction (validated caller). */
function push_section_sentence({ db, events, section_id, sentence_id, sort_key, now, user_id, api_key_id }: {
  db: Database.Database
  events: HistoryEvent[]
  section_id: string
  sentence_id: string
  sort_key: string
  now: string
  user_id: string
  api_key_id?: string | null
}) {
  const event = merge_dict_row({ db, table_name: 'section_sentences', row: { id: crypto.randomUUID(), section_id, sentence_id, sort_key, created_at: now, updated_at: now }, user_id, at: now, api_key_id })
  if (event) events.push(event)
}

export interface CreateSectionResult { section: GrammarSectionRecord, created: boolean, cursor: string | null }

export function create_section({ db, history_db, user_id, api_key_id, input }: {
  db: Database.Database
  history_db?: Database.Database
  user_id: string
  api_key_id?: string | null
  input: GrammarSectionInput
}): CreateSectionResult {
  const title = to_multistring(input.title)
  const body = to_multistring(input.body)
  if (!title && !body)
    throw new Error('a section needs at least a title or a body')
  const section_id = resolve_client_id(input.id, { field: 'section id' })

  if (input.id) {
    const existing = get_section(db, section_id)
    if (existing)
      return { section: existing, created: false, cursor: read_last_modified_at(db) }
  }

  const parent_id = input.parent_id ?? null
  assert_section_refs({ db, parent_id, slot_id: input.slot_id, entry_id: input.entry_id, sense_id: input.sense_id, self_id: section_id })
  const example_ids = input.example_sentence_ids ?? []
  for (const sentence_id of example_ids) {
    if (!row_exists(db, 'sentences', sentence_id))
      throw new Error(`sentence '${sentence_id}' not found`)
  }

  const now = new Date().toISOString()
  const events: HistoryEvent[] = []
  db.exec('BEGIN IMMEDIATE')
  try {
    const sort_key = sibling_sort_key({ db, parent_id, after_section_id: input.after_section_id })
    const row: Record<string, unknown> = { id: section_id, parent_id, sort_key, created_at: now, updated_at: now }
    if (title) row.title = title
    if (input.number_label) row.number_label = input.number_label
    if (body) row.body = body
    const usage = to_multistring(input.usage_conditions); if (usage) row.usage_conditions = usage
    if (input.slot_id) row.slot_id = input.slot_id
    if (input.entry_id) row.entry_id = input.entry_id
    if (input.sense_id) row.sense_id = input.sense_id
    const event = merge_dict_row({ db, table_name: 'grammar_sections', row, user_id, at: now, api_key_id })
    if (event) events.push(event)

    let prev: string | null = null
    for (const sentence_id of example_ids) {
      const sort = key_between(prev, null)
      push_section_sentence({ db, events, section_id, sentence_id, sort_key: sort, now, user_id, api_key_id })
      prev = sort
    }

    const cursor = read_last_modified_at(db)
    db.exec('COMMIT')
    commit_history(history_db, events)
    const section = get_section(db, section_id)
    if (!section)
      throw new Error('section vanished after create')
    return { section, created: true, cursor }
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

export interface UpdateSectionResult extends SingleWriteResult { section?: GrammarSectionRecord }

export function apply_section_update({ db, history_db, section_id, patch, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  section_id: string
  patch: GrammarSectionPatch
  user_id: string
  api_key_id?: string | null
}): UpdateSectionResult {
  const existing_raw = db.prepare(`SELECT * FROM grammar_sections WHERE id = ?`).get(section_id) as Record<string, unknown> | undefined
  if (!existing_raw)
    return { found: false, new_synced_up_to: read_last_modified_at(db) }
  const existing = parse_dict_row('grammar_sections', existing_raw)

  const reparenting = patch.parent_id !== undefined || patch.after_section_id !== undefined
  const new_parent = patch.parent_id !== undefined ? (patch.parent_id ?? null) : (existing.parent_id as string ?? null)
  assert_section_refs({ db, parent_id: patch.parent_id, slot_id: patch.slot_id, entry_id: patch.entry_id, sense_id: patch.sense_id, self_id: section_id })

  const now = new Date().toISOString()
  const row: Record<string, unknown> = { ...existing, updated_at: now }
  delete row.updated_by_user_id

  if (patch.title !== undefined)
    row.title = to_multistring(patch.title) ?? null
  if (patch.body !== undefined) row.body = to_multistring(patch.body) ?? null
  if (!row.title && !row.body)
    throw new Error('a section needs at least a title or a body')
  if (patch.usage_conditions !== undefined) row.usage_conditions = to_multistring(patch.usage_conditions) ?? null
  if (patch.number_label !== undefined) row.number_label = patch.number_label ?? null
  if (patch.slot_id !== undefined) row.slot_id = patch.slot_id ?? null
  if (patch.entry_id !== undefined) row.entry_id = patch.entry_id ?? null
  if (patch.sense_id !== undefined) row.sense_id = patch.sense_id ?? null
  if (reparenting) {
    row.parent_id = new_parent
    row.sort_key = sibling_sort_key({ db, parent_id: new_parent, after_section_id: patch.after_section_id, exclude_id: section_id })
  }

  const event = merge_dict_row({ db, table_name: 'grammar_sections', row, user_id, at: now, api_key_id })
  commit_history(history_db, event ? [event] : [])
  return { found: true, new_synced_up_to: read_last_modified_at(db), section: get_section(db, section_id) }
}

/** Delete a section — the FK cascade removes descendant sections + detaches example links. */
export function apply_section_delete({ db, history_db, section_id, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  section_id: string
  user_id: string
  api_key_id?: string | null
}): SingleWriteResult {
  return run_tombstone_delete({ db, history_db, table_name: 'grammar_sections', id: section_id, user_id, api_key_id })
}

// ── Section ↔ sentence example links ──────────────────────────────────────────

export interface LinkSectionSentenceResult { link?: SectionSentenceRef, found: boolean, created: boolean, cursor: string | null }

export function link_section_sentence({ db, history_db, section_id, sentence_id, after_sentence_id, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  section_id: string
  sentence_id: string
  after_sentence_id?: string
  user_id: string
  api_key_id?: string | null
}): LinkSectionSentenceResult {
  if (!row_exists(db, 'grammar_sections', section_id) || !row_exists(db, 'sentences', sentence_id))
    return { found: false, created: false, cursor: read_last_modified_at(db) }

  const existing = db.prepare(`SELECT id, sentence_id, sort_key FROM section_sentences WHERE section_id = ? AND sentence_id = ?`).get(section_id, sentence_id) as SectionSentenceRef | undefined
  if (existing)
    return { link: existing, found: true, created: false, cursor: read_last_modified_at(db) }

  const attached = db.prepare(`SELECT id, sentence_id, sort_key FROM section_sentences WHERE section_id = ? ORDER BY sort_key ASC, created_at ASC`).all(section_id) as SectionSentenceRef[]
  let sort_key: string
  if (after_sentence_id) {
    const index = attached.findIndex(a => a.sentence_id === after_sentence_id)
    if (index === -1)
      throw new Error(`after_sentence_id '${after_sentence_id}' is not attached to this section`)
    sort_key = key_between(attached[index].sort_key, attached[index + 1]?.sort_key ?? null)
  } else {
    sort_key = key_between(attached[attached.length - 1]?.sort_key ?? null, null)
  }

  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  const event = merge_dict_row({ db, table_name: 'section_sentences', row: { id, section_id, sentence_id, sort_key, created_at: now, updated_at: now }, user_id, at: now, api_key_id })
  commit_history(history_db, event ? [event] : [])
  return { link: { id, sentence_id, sort_key }, found: true, created: true, cursor: read_last_modified_at(db) }
}

export function unlink_section_sentence({ db, history_db, section_id, sentence_id, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  section_id: string
  sentence_id: string
  user_id: string
  api_key_id?: string | null
}): SingleWriteResult {
  const junction = db.prepare(`SELECT id FROM section_sentences WHERE section_id = ? AND sentence_id = ?`).get(section_id, sentence_id) as { id: string } | undefined
  if (!junction)
    return { found: false, new_synced_up_to: read_last_modified_at(db) }
  return run_tombstone_delete({ db, history_db, table_name: 'section_sentences', id: junction.id, user_id, api_key_id })
}

// ── Clause slots ──────────────────────────────────────────────────────────────

export interface ClauseSlotInput { id?: string, code?: string, name: MultiString | string, after_slot_id?: string }
export interface ClauseSlotRecord { id: string, code: string | null, name: MultiString, sort_key: string | null, updated_at: string }

function clause_slot_from_row(raw: Record<string, unknown>): ClauseSlotRecord {
  const parsed = parse_dict_row('clause_slots', raw)
  return { id: parsed.id as string, code: (parsed.code as string) ?? null, name: (parsed.name as MultiString) ?? {}, sort_key: (parsed.sort_key as string) ?? null, updated_at: parsed.updated_at as string }
}

export function list_clause_slots(db: Database.Database): ClauseSlotRecord[] {
  const rows = db.prepare(`SELECT * FROM clause_slots ORDER BY sort_key ASC, created_at ASC`).all() as Record<string, unknown>[]
  return rows.map(clause_slot_from_row)
}

function clause_slot_sort_key({ db, after_slot_id, exclude_id }: { db: Database.Database, after_slot_id?: string, exclude_id?: string }): string {
  const slots = list_clause_slots(db).filter(s => s.id !== exclude_id)
  if (after_slot_id) {
    const index = slots.findIndex(s => s.id === after_slot_id)
    if (index === -1)
      throw new Error(`after_slot_id '${after_slot_id}' not found`)
    return key_between(slots[index].sort_key, slots[index + 1]?.sort_key ?? null)
  }
  return key_between(slots[slots.length - 1]?.sort_key ?? null, null)
}

export function create_clause_slot({ db, history_db, user_id, api_key_id, input }: {
  db: Database.Database
  history_db?: Database.Database
  user_id: string
  api_key_id?: string | null
  input: ClauseSlotInput
}): { clause_slot: ClauseSlotRecord, created: boolean, cursor: string | null } {
  const name = to_multistring(input.name)
  if (!name)
    throw new Error('clause slot name is required')
  const id = resolve_client_id(input.id, { field: 'clause slot id' })
  if (input.id && row_exists(db, 'clause_slots', id)) {
    const raw = db.prepare(`SELECT * FROM clause_slots WHERE id = ?`).get(id) as Record<string, unknown>
    return { clause_slot: clause_slot_from_row(raw), created: false, cursor: read_last_modified_at(db) }
  }
  const now = new Date().toISOString()
  const sort_key = clause_slot_sort_key({ db, after_slot_id: input.after_slot_id })
  const row: Record<string, unknown> = { id, name, sort_key, created_at: now, updated_at: now }
  if (input.code) row.code = input.code
  const event = merge_dict_row({ db, table_name: 'clause_slots', row, user_id, at: now, api_key_id })
  commit_history(history_db, event ? [event] : [])
  const raw = db.prepare(`SELECT * FROM clause_slots WHERE id = ?`).get(id) as Record<string, unknown>
  return { clause_slot: clause_slot_from_row(raw), created: true, cursor: read_last_modified_at(db) }
}

export interface UpdateClauseSlotResult extends SingleWriteResult { clause_slot?: ClauseSlotRecord }

export function apply_clause_slot_update({ db, history_db, slot_id, input, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  slot_id: string
  input: { name?: MultiString | string, code?: string | null, after_slot_id?: string }
  user_id: string
  api_key_id?: string | null
}): UpdateClauseSlotResult {
  const existing_raw = db.prepare(`SELECT * FROM clause_slots WHERE id = ?`).get(slot_id) as Record<string, unknown> | undefined
  if (!existing_raw)
    return { found: false, new_synced_up_to: read_last_modified_at(db) }
  const now = new Date().toISOString()
  const row: Record<string, unknown> = { ...parse_dict_row('clause_slots', existing_raw), updated_at: now }
  delete row.updated_by_user_id
  if (input.name !== undefined) {
    const name = to_multistring(input.name)
    if (!name)
      throw new Error('clause slot name cannot be empty')
    row.name = name
  }
  if (input.code !== undefined) row.code = input.code ?? null
  if (input.after_slot_id !== undefined) row.sort_key = clause_slot_sort_key({ db, after_slot_id: input.after_slot_id, exclude_id: slot_id })
  const event = merge_dict_row({ db, table_name: 'clause_slots', row, user_id, at: now, api_key_id })
  commit_history(history_db, event ? [event] : [])
  const raw = db.prepare(`SELECT * FROM clause_slots WHERE id = ?`).get(slot_id) as Record<string, unknown>
  return { found: true, new_synced_up_to: read_last_modified_at(db), clause_slot: clause_slot_from_row(raw) }
}

export function apply_clause_slot_delete({ db, history_db, slot_id, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  slot_id: string
  user_id: string
  api_key_id?: string | null
}): SingleWriteResult {
  return run_tombstone_delete({ db, history_db, table_name: 'clause_slots', id: slot_id, user_id, api_key_id })
}

// ── Glossing abbreviations (legend; keyed by `code`) ──────────────────────────

export interface GlossingAbbreviationInput { code: string, name: MultiString | string, category?: string }
export interface GlossingAbbreviationRecord { id: string, code: string, name: MultiString, category: string | null, updated_at: string }

function glossing_from_row(raw: Record<string, unknown>): GlossingAbbreviationRecord {
  const parsed = parse_dict_row('glossing_abbreviations', raw)
  return { id: parsed.id as string, code: parsed.code as string, name: (parsed.name as MultiString) ?? {}, category: (parsed.category as string) ?? null, updated_at: parsed.updated_at as string }
}

export function list_glossing_abbreviations(db: Database.Database): GlossingAbbreviationRecord[] {
  const rows = db.prepare(`SELECT * FROM glossing_abbreviations ORDER BY code ASC`).all() as Record<string, unknown>[]
  return rows.map(glossing_from_row)
}

function read_glossing_by_code(db: Database.Database, code: string): Record<string, unknown> | undefined {
  return db.prepare(`SELECT * FROM glossing_abbreviations WHERE code = ?`).get(code) as Record<string, unknown> | undefined
}

export function find_or_create_glossing_abbreviation({ db, history_db, user_id, api_key_id, input }: {
  db: Database.Database
  history_db?: Database.Database
  user_id: string
  api_key_id?: string | null
  input: GlossingAbbreviationInput
}): { glossing_abbreviation: GlossingAbbreviationRecord, created: boolean, cursor: string | null } {
  const code = (input.code || '').trim()
  if (!code)
    throw new Error('glossing abbreviation code is required')
  const name = to_multistring(input.name)
  if (!name)
    throw new Error('glossing abbreviation name is required')
  const existing = read_glossing_by_code(db, code)
  if (existing)
    return { glossing_abbreviation: glossing_from_row(existing), created: false, cursor: read_last_modified_at(db) }
  const now = new Date().toISOString()
  const row: Record<string, unknown> = { id: crypto.randomUUID(), code, name, created_at: now, updated_at: now }
  if (input.category) row.category = input.category
  const event = merge_dict_row({ db, table_name: 'glossing_abbreviations', row, user_id, at: now, api_key_id })
  commit_history(history_db, event ? [event] : [])
  return { glossing_abbreviation: glossing_from_row(read_glossing_by_code(db, code) as Record<string, unknown>), created: true, cursor: read_last_modified_at(db) }
}

export interface UpdateGlossingResult extends SingleWriteResult { glossing_abbreviation?: GlossingAbbreviationRecord }

export function apply_glossing_abbreviation_update({ db, history_db, code, input, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  code: string
  input: { name?: MultiString | string, category?: string | null }
  user_id: string
  api_key_id?: string | null
}): UpdateGlossingResult {
  const existing_raw = read_glossing_by_code(db, code)
  if (!existing_raw)
    return { found: false, new_synced_up_to: read_last_modified_at(db) }
  const now = new Date().toISOString()
  const row: Record<string, unknown> = { ...parse_dict_row('glossing_abbreviations', existing_raw), updated_at: now }
  delete row.updated_by_user_id
  if (input.name !== undefined) {
    const name = to_multistring(input.name)
    if (!name)
      throw new Error('glossing abbreviation name cannot be empty')
    row.name = name
  }
  if (input.category !== undefined) row.category = input.category ?? null
  const event = merge_dict_row({ db, table_name: 'glossing_abbreviations', row, user_id, at: now, api_key_id })
  commit_history(history_db, event ? [event] : [])
  return { found: true, new_synced_up_to: read_last_modified_at(db), glossing_abbreviation: glossing_from_row(read_glossing_by_code(db, code) as Record<string, unknown>) }
}

export function apply_glossing_abbreviation_delete({ db, history_db, code, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  code: string
  user_id: string
  api_key_id?: string | null
}): SingleWriteResult {
  const existing = read_glossing_by_code(db, code)
  if (!existing)
    return { found: false, new_synced_up_to: read_last_modified_at(db) }
  return run_tombstone_delete({ db, history_db, table_name: 'glossing_abbreviations', id: existing.id as string, user_id, api_key_id })
}
