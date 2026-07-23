import type Database from 'better-sqlite3'
import type { HistoryEvent } from './dictionary-history-db'
import type { SingleWriteResult } from './v1-entry-write'
import type { CustomRelationshipTypeInput, RelationshipInput, RelationshipTypeRecord, RelationshipView } from '$lib/api/v1/relationship-input'
import type { MultiString } from '$lib/types'
import { to_multistring, to_string_array } from '$lib/api/v1/entry-input'
import { is_global_relationship_type, RELATIONSHIP_TYPES } from '$lib/constants'
import { canonicalize_relationship_endpoints, resolve_global_relationship_type } from '$lib/db/relationship-canonicalize'
import { parse_dict_row } from '$lib/db/schemas/dictionary-json-columns'
import { read_last_modified_at } from './dictionary-db'
import { record_history } from './dictionary-history-db'
import { merge_dict_row } from './dictionary-sync-helpers'
import { assert_known_source_slugs, load_source_slug_set } from './source-slugs'
import { run_tombstone_delete } from './v1-entry-write'

/**
 * Server-side write path for `/api/v1` entry relationships. Single-row writes go
 * through `merge_dict_row` (the SAME path a browser editor push uses → identical
 * audit stamping, `last_modified_at` bump, and history capture). Custom types are
 * found-or-created (deduped by name), like tags/dialects.
 */

function name_key(name: string): string {
  return name.trim().toLowerCase()
}

function multistring_values(value: MultiString | null | undefined): string[] {
  return Object.values(value ?? {}).filter((v): v is string => typeof v === 'string' && !!v.trim())
}

function prune(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (value !== undefined)
      out[key] = value
  }
  return out
}

function commit_history(history_db: Database.Database | undefined, event: HistoryEvent | null) {
  if (history_db && event) {
    try {
      record_history(history_db, [event])
    } catch (err) {
      console.warn('Could not record v1 relationship history:', err)
    }
  }
}

// ── Custom relationship types (found-or-created, like tags/dialects) ───────────

function parse_relationship_type(row: Record<string, unknown>): RelationshipTypeRecord {
  const parsed = parse_dict_row('relationship_types', row)
  return {
    id: parsed.id as string,
    name: (parsed.name as MultiString) ?? {},
    inverse_name: (parsed.inverse_name as MultiString) ?? null,
    symmetric: !!parsed.symmetric,
  }
}

export function list_relationship_types(db: Database.Database): RelationshipTypeRecord[] {
  const rows = db.prepare(`SELECT * FROM relationship_types ORDER BY created_at`).all() as Record<string, unknown>[]
  return rows.map(parse_relationship_type)
}

export function find_or_create_relationship_type({ db, history_db, input, user_id, api_key_id, history_events }: {
  db: Database.Database
  history_db?: Database.Database
  input: CustomRelationshipTypeInput
  user_id: string
  api_key_id?: string | null
  /** When provided, history is COLLECTED here (batch path — recorded after commit) instead of written immediately. */
  history_events?: HistoryEvent[]
}): { type: RelationshipTypeRecord, created: boolean, cursor: string | null } {
  const name = to_multistring(input.name)
  if (!name)
    throw new Error('custom relationship type name is required')
  const inverse_name = to_multistring(input.inverse_name)
  // Symmetric defaults to true unless an inverse label is provided or it's set false.
  const symmetric = input.symmetric ?? !inverse_name

  const keys = new Set(multistring_values(name).map(name_key))
  const existing = list_relationship_types(db).find(type => multistring_values(type.name).some(value => keys.has(name_key(value))))
  if (existing)
    return { type: existing, created: false, cursor: read_last_modified_at(db) }

  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  const event = merge_dict_row({
    db,
    table_name: 'relationship_types',
    row: prune({ id, name, inverse_name: symmetric ? undefined : inverse_name, symmetric: symmetric ? 1 : undefined, created_at: now, updated_at: now }),
    user_id,
    at: now,
    api_key_id,
  })
  if (history_events) {
    if (event)
      history_events.push(event)
  } else {
    commit_history(history_db, event)
  }
  return { type: { id, name, inverse_name: symmetric ? null : (inverse_name ?? null), symmetric }, created: true, cursor: read_last_modified_at(db) }
}

// ── Read (assemble views) ─────────────────────────────────────────────────────

/** Shape one relationship row as seen FROM `viewpoint_entry_id`. */
function build_relationship_view({ db, row, viewpoint_entry_id, type_cache, lexeme_cache }: {
  db: Database.Database
  row: Record<string, unknown>
  viewpoint_entry_id: string
  type_cache: Map<string, RelationshipTypeRecord>
  lexeme_cache: Map<string, MultiString>
}): RelationshipView {
  const from_entry_id = row.from_entry_id as string
  const to_entry_id = row.to_entry_id as string
  const forward = from_entry_id === viewpoint_entry_id

  const related_entry_id = forward ? to_entry_id : from_entry_id
  const related_sense_id = (forward ? row.to_sense_id : row.from_sense_id) as string | null

  let lexeme = lexeme_cache.get(related_entry_id)
  if (!lexeme) {
    const entry_row = db.prepare(`SELECT lexeme FROM entries WHERE id = ?`).get(related_entry_id) as { lexeme: string } | undefined
    lexeme = entry_row ? ((parse_dict_row('entries', entry_row).lexeme as MultiString) ?? {}) : {}
    lexeme_cache.set(related_entry_id, lexeme)
  }

  const base: RelationshipView = {
    id: row.id as string,
    type: '',
    custom: false,
    symmetric: false,
    direction: forward ? 'forward' : 'inverse',
    related: prune({ entry_id: related_entry_id, sense_id: related_sense_id ?? undefined, lexeme }) as RelationshipView['related'],
    note: (row.note as MultiString) ?? undefined,
    sources: (row.sources as string[]) ?? undefined,
  }

  const custom_type_id = row.custom_type_id as string | null
  if (custom_type_id) {
    let type = type_cache.get(custom_type_id)
    if (!type) {
      const type_row = db.prepare(`SELECT * FROM relationship_types WHERE id = ?`).get(custom_type_id) as Record<string, unknown> | undefined
      type = type_row ? parse_relationship_type(type_row) : { id: custom_type_id, name: {}, inverse_name: null, symmetric: true }
      type_cache.set(custom_type_id, type)
    }
    base.type = custom_type_id
    base.custom = true
    base.symmetric = type.symmetric
    base.name = forward ? type.name : (type.inverse_name ?? type.name)
    return base
  }

  const slug = row.type as string
  const global = RELATIONSHIP_TYPES[slug as keyof typeof RELATIONSHIP_TYPES]
  const slug_for_side = forward ? slug : (global?.inverse_slug ?? slug)
  base.type = slug
  base.symmetric = global?.symmetric ?? false
  base.label_key = `relationship_type.${slug_for_side}`
  return base
}

/** All relationships touching an entry (both directions), shaped from its viewpoint. */
export function list_relationships_for_entry(db: Database.Database, entry_id: string): RelationshipView[] {
  const rows = db.prepare(
    `SELECT * FROM entry_relationships WHERE from_entry_id = ? OR to_entry_id = ? ORDER BY created_at`,
  ).all(entry_id, entry_id) as Record<string, unknown>[]
  const type_cache = new Map<string, RelationshipTypeRecord>()
  const lexeme_cache = new Map<string, MultiString>()
  return rows.map(row => build_relationship_view({ db, row: parse_dict_row('entry_relationships', row), viewpoint_entry_id: entry_id, type_cache, lexeme_cache }))
}

// ── Create ────────────────────────────────────────────────────────────────────

function entry_exists(db: Database.Database, entry_id: string): boolean {
  return !!db.prepare(`SELECT 1 FROM entries WHERE id = ?`).get(entry_id)
}

function sense_belongs_to_entry(db: Database.Database, sense_id: string, entry_id: string): boolean {
  const row = db.prepare(`SELECT entry_id FROM senses WHERE id = ?`).get(sense_id) as { entry_id: string } | undefined
  return !!row && row.entry_id === entry_id
}

/**
 * Resolve the relationship's type: a global slug, or a found-or-created custom
 * type. A directed inverse-alias global (e.g. `hyponym`) resolves to its canonical
 * partner (`hypernym`) with `flip: true`, so the caller swaps endpoints and every
 * stored row uses one slug per concept-pair.
 */
function resolve_relationship_type({ db, input, user_id, api_key_id, history_events }: {
  db: Database.Database
  input: RelationshipInput
  user_id: string
  api_key_id?: string | null
  history_events: HistoryEvent[]
}): { type?: string, custom_type_id?: string, symmetric: boolean, flip: boolean } {
  if (input.custom_type) {
    const { type } = find_or_create_relationship_type({ db, input: input.custom_type, user_id, api_key_id, history_events })
    return { custom_type_id: type.id, symmetric: type.symmetric, flip: false }
  }
  return resolve_global_relationship_type(input.type as keyof typeof RELATIONSHIP_TYPES)
}

/**
 * Validate + create ONE relationship inside an ALREADY-OPEN transaction.
 * History events are collected into `history_events` (recorded by the caller
 * after commit). Throws on invalid input / unknown ids.
 */
function create_relationship_in_open_tx({ db, input, user_id, api_key_id, history_events }: {
  db: Database.Database
  input: RelationshipInput
  user_id: string
  api_key_id?: string | null
  history_events: HistoryEvent[]
}): { relationship: RelationshipView, created: boolean } {
  const from_entry_id = (input.from_entry_id || '').trim()
  const to_entry_id = (input.to_entry_id || '').trim()
  if (!from_entry_id || !to_entry_id)
    throw new Error('from_entry_id and to_entry_id are required')
  if (!input.type && !input.custom_type)
    throw new Error('a `type` (global slug) or `custom_type` is required')
  if (input.type && input.custom_type)
    throw new Error('provide either `type` or `custom_type`, not both')
  if (input.type && !is_global_relationship_type(input.type))
    throw new Error(`unknown relationship type '${input.type}'; use a custom_type or a known global slug`)

  if (!entry_exists(db, from_entry_id))
    throw new Error(`from_entry_id '${from_entry_id}' not found`)
  if (!entry_exists(db, to_entry_id))
    throw new Error(`to_entry_id '${to_entry_id}' not found`)

  const from_sense_id = input.from_sense_id?.trim() || null
  const to_sense_id = input.to_sense_id?.trim() || null
  if (from_sense_id && !sense_belongs_to_entry(db, from_sense_id, from_entry_id))
    throw new Error(`from_sense_id '${from_sense_id}' does not belong to from_entry_id`)
  if (to_sense_id && !sense_belongs_to_entry(db, to_sense_id, to_entry_id))
    throw new Error(`to_sense_id '${to_sense_id}' does not belong to to_entry_id`)

  if (from_entry_id === to_entry_id && (from_sense_id ?? '') === (to_sense_id ?? ''))
    throw new Error('cannot relate an entry (or sense) to itself')

  const note = to_multistring(input.note)
  const sources = to_string_array(input.sources)
  assert_known_source_slugs(sources, load_source_slug_set(db))

  const now = new Date().toISOString()

  // Resolve type (global slug or find-or-create custom) — before dedupe so a
  // custom type re-use maps to the same id.
  const { type, custom_type_id, symmetric, flip } = resolve_relationship_type({ db, input, user_id, api_key_id, history_events })

  // Inverse-alias flip (e.g. hyponym→hypernym) + symmetric endpoint sort so
  // A→B and B→A collapse — shared with the browser editing UI.
  const { from, to } = canonicalize_relationship_endpoints({
    from: { entry_id: from_entry_id, sense_id: from_sense_id },
    to: { entry_id: to_entry_id, sense_id: to_sense_id },
    symmetric,
    flip,
  })

  // Dedupe against the natural key (COALESCE mirrors the unique index).
  const existing = db.prepare(
    `SELECT * FROM entry_relationships
      WHERE from_entry_id = ? AND COALESCE(from_sense_id,'') = ?
        AND to_entry_id = ? AND COALESCE(to_sense_id,'') = ?
        AND COALESCE(type,'') = ? AND COALESCE(custom_type_id,'') = ?`,
  ).get(from.entry_id, from.sense_id ?? '', to.entry_id, to.sense_id ?? '', type ?? '', custom_type_id ?? '') as Record<string, unknown> | undefined

  const type_cache = new Map<string, RelationshipTypeRecord>()
  const lexeme_cache = new Map<string, MultiString>()

  if (existing) {
    const view = build_relationship_view({ db, row: parse_dict_row('entry_relationships', existing), viewpoint_entry_id: from_entry_id, type_cache, lexeme_cache })
    return { relationship: view, created: false }
  }

  const id = crypto.randomUUID()
  const event = merge_dict_row({
    db,
    table_name: 'entry_relationships',
    row: prune({
      id,
      from_entry_id: from.entry_id,
      from_sense_id: from.sense_id ?? undefined,
      to_entry_id: to.entry_id,
      to_sense_id: to.sense_id ?? undefined,
      type,
      custom_type_id,
      note,
      sources,
      created_at: now,
      updated_at: now,
    }),
    user_id,
    at: now,
    api_key_id,
  })
  if (event)
    history_events.push(event)

  const created_row = db.prepare(`SELECT * FROM entry_relationships WHERE id = ?`).get(id) as Record<string, unknown>
  const view = build_relationship_view({ db, row: parse_dict_row('entry_relationships', created_row), viewpoint_entry_id: from_entry_id, type_cache, lexeme_cache })
  return { relationship: view, created: true }
}

export function apply_relationship_create({ db, history_db, input, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  input: RelationshipInput
  user_id: string
  api_key_id?: string | null
}): { relationship: RelationshipView, created: boolean, cursor: string | null } {
  const history_events: HistoryEvent[] = []
  db.exec('BEGIN IMMEDIATE')
  let result: { relationship: RelationshipView, created: boolean }
  let cursor: string | null
  try {
    result = create_relationship_in_open_tx({ db, input, user_id, api_key_id, history_events })
    cursor = read_last_modified_at(db)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }

  if (history_db && history_events.length) {
    try {
      record_history(history_db, history_events)
    } catch (err) {
      console.warn('Could not record v1 relationship history:', err)
    }
  }

  return { relationship: result.relationship, created: result.created, cursor }
}

// ── Batch create ──────────────────────────────────────────────────────────────

export interface RelationshipWriteResult {
  /** `created` — new row. `exists` — idempotent no-op (identical relationship already present). `failed` — see `error`. */
  status: 'created' | 'exists' | 'failed'
  relationship_id?: string
  error?: string
}

export interface RelationshipsBatchResult {
  created: number
  /** Items that were idempotent no-ops (an identical relationship already existed). */
  existed: number
  failed: number
  results: RelationshipWriteResult[]
  cursor: string | null
}

/**
 * Batch-create relationships: ONE transaction for the whole call, a SAVEPOINT
 * per item (per-item best-effort — a bad item rolls back just itself and is
 * reported `failed`, the rest commit). Same contract shape as bulk entries:
 * `results` in input order, retry-safe (`exists` on an idempotent re-POST).
 */
export function apply_relationship_batch({ db, history_db, relationships, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  relationships: RelationshipInput[]
  user_id: string
  api_key_id?: string | null
}): RelationshipsBatchResult {
  const history_events: HistoryEvent[] = []
  const results: RelationshipWriteResult[] = []
  let created = 0
  let existed = 0
  let failed = 0

  db.exec('BEGIN IMMEDIATE')
  try {
    for (const input of relationships) {
      db.exec('SAVEPOINT v1_rel_item')
      // Buffer this item's history locally — merged only after RELEASE, so a
      // rolled-back item leaves no phantom history (same as bulk entries).
      const item_history: HistoryEvent[] = []
      try {
        const { relationship, created: was_created } = create_relationship_in_open_tx({ db, input, user_id, api_key_id, history_events: item_history })
        db.exec('RELEASE v1_rel_item')
        history_events.push(...item_history)
        if (was_created) {
          results.push({ status: 'created', relationship_id: relationship.id })
          created++
        } else {
          results.push({ status: 'exists', relationship_id: relationship.id })
          existed++
        }
      } catch (err) {
        db.exec('ROLLBACK TO v1_rel_item')
        db.exec('RELEASE v1_rel_item')
        results.push({ status: 'failed', error: (err as Error).message })
        failed++
      }
    }

    const cursor = read_last_modified_at(db)
    db.exec('COMMIT')

    if (history_db && history_events.length) {
      try {
        record_history(history_db, history_events)
      } catch (err) {
        console.warn('Could not record v1 relationship batch history:', err)
      }
    }

    return { created, existed, failed, results, cursor }
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

export function apply_relationship_delete({ db, history_db, id, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  id: string
  user_id: string
  api_key_id?: string | null
}): SingleWriteResult {
  return run_tombstone_delete({ db, history_db, table_name: 'entry_relationships', id, user_id, api_key_id })
}
