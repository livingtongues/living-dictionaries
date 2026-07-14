import type Database from 'better-sqlite3'
import type { HistoryEvent } from './dictionary-history-db'
import type { SingleWriteResult } from './v1-entry-write'
import type { SentenceIgtFields } from '$lib/api/v1/entry-input'
import type { SentenceTokens, SourceCitation } from '$lib/db/schemas/dictionary.types'
import type { MultiString } from '$lib/types'
import { resolve_client_id, to_multistring, to_string_array } from '$lib/api/v1/entry-input'
import { citation_slugs, resolve_sentence_igt, to_citations, to_discourse_role } from '$lib/api/v1/sentence-igt'
import { initial_keys, key_between } from '$lib/api/v1/fractional-index'
import { parse_dict_row } from '$lib/db/schemas/dictionary-json-columns'
import { read_last_modified_at } from './dictionary-db'
import { record_history } from './dictionary-history-db'
import { merge_dict_row } from './dictionary-sync-helpers'
import { assert_known_source_slugs, load_source_slug_set } from './source-slugs'
import { run_tombstone_delete } from './v1-entry-write'

/**
 * `/api/v1` TEXTS sub-resource: a per-dict long-text / story (`texts.title`) with
 * ORDERED child sentences. A text-sentence is a `sentences` row carrying
 * `text_id` + a fractional `sort_key` (+ `ends_paragraph`) and — unlike an
 * entry's example sentence — is NOT linked to a sense (no `senses_in_sentences`).
 * Writes go through `merge_dict_row` (same path + history as a browser push).
 */

/** Agent-facing input for one sentence within a text. */
export interface TextSentenceInput extends SentenceIgtFields {
  /** Optional client-generated UUID (idempotency + known-id-for-edits). */
  id?: string
  text?: MultiString | string
  translation?: MultiString | string
  sources?: string[] | string
  /** 1/true → a paragraph break follows this sentence. */
  ends_paragraph?: boolean | number
}

export interface TextCreateInput {
  id?: string
  title: MultiString | string
  sentences?: TextSentenceInput[]
}

export interface TextPatchInput {
  title?: MultiString | string
  /** New sentences appended after the current last one, in array order. */
  append_sentences?: TextSentenceInput[]
  /** Full ordering of EXISTING sentence ids — sort_keys are reassigned to match. */
  sentence_order?: string[]
}

export interface TextSentenceRecord {
  id: string
  text: MultiString | null
  translation: MultiString | null
  sources: string[] | null
  tokens: SentenceTokens | null
  citations: SourceCitation[] | null
  example_label: string | null
  discourse_role: string | null
  ends_paragraph: number | null
  sort_key: string | null
}

export interface TextRecord {
  id: string
  title: MultiString
  updated_at: string
  sentences: TextSentenceRecord[]
}

export interface TextSummary {
  id: string
  title: MultiString
  sentence_count: number
  updated_at: string
}

function commit_history(history_db: Database.Database | undefined, events: HistoryEvent[]) {
  if (history_db && events.length) {
    try {
      record_history(history_db, events)
    } catch (err) {
      console.warn('Could not record v1 text history:', err)
    }
  }
}

function ends_paragraph_value(value: boolean | number | undefined): number | undefined {
  return value ? 1 : undefined
}

function build_text_sentence_row({ sentence, text_id, sort_key, now, source_slug_set }: {
  sentence: TextSentenceInput
  text_id: string
  sort_key: string
  now: string
  source_slug_set: Set<string>
}): Record<string, unknown> {
  const translation = to_multistring(sentence.translation)
  const sources = to_string_array(sentence.sources)
  assert_known_source_slugs(sources, source_slug_set)
  const { tokens, text } = resolve_sentence_igt({ tokens: sentence.tokens, text: to_multistring(sentence.text) })
  const citations = to_citations(sentence.citations)
  assert_known_source_slugs(citation_slugs(citations), source_slug_set)
  const discourse_role = to_discourse_role(sentence.discourse_role)
  const example_label = sentence.example_label?.trim() || undefined
  const row: Record<string, unknown> = {
    id: resolve_client_id(sentence.id, { field: 'sentence id' }),
    text_id,
    sort_key,
    ends_paragraph: ends_paragraph_value(sentence.ends_paragraph),
    created_at: now,
    updated_at: now,
  }
  if (text) row.text = text
  if (translation) row.translation = translation
  if (sources) row.sources = sources
  if (tokens) row.tokens = tokens
  if (citations) row.citations = citations
  if (discourse_role) row.discourse_role = discourse_role
  if (example_label) row.example_label = example_label
  return row
}

function read_text_row(db: Database.Database, text_id: string): { id: string, title: MultiString, updated_at: string } | undefined {
  const row = db.prepare(`SELECT * FROM texts WHERE id = ?`).get(text_id) as Record<string, unknown> | undefined
  if (!row)
    return undefined
  const parsed = parse_dict_row('texts', row)
  return { id: parsed.id as string, title: (parsed.title as MultiString) ?? {}, updated_at: parsed.updated_at as string }
}

function list_text_sentences(db: Database.Database, text_id: string): TextSentenceRecord[] {
  const rows = db.prepare(
    `SELECT id, text, translation, sources, tokens, citations, example_label, discourse_role, ends_paragraph, sort_key
     FROM sentences WHERE text_id = ? ORDER BY sort_key ASC, created_at ASC`,
  ).all(text_id) as { id: string, text: string | null, translation: string | null, sources: string | null, tokens: string | null, citations: string | null, example_label: string | null, discourse_role: string | null, ends_paragraph: number | null, sort_key: string | null }[]
  return rows.map(row => ({
    id: row.id,
    text: row.text ? JSON.parse(row.text) as MultiString : null,
    translation: row.translation ? JSON.parse(row.translation) as MultiString : null,
    sources: row.sources ? JSON.parse(row.sources) as string[] : null,
    tokens: row.tokens ? JSON.parse(row.tokens) as SentenceTokens : null,
    citations: row.citations ? JSON.parse(row.citations) as SourceCitation[] : null,
    example_label: row.example_label,
    discourse_role: row.discourse_role,
    ends_paragraph: row.ends_paragraph,
    sort_key: row.sort_key,
  }))
}

export function get_text(db: Database.Database, text_id: string): TextRecord | undefined {
  const text = read_text_row(db, text_id)
  if (!text)
    return undefined
  return { ...text, sentences: list_text_sentences(db, text_id) }
}

export function list_texts(db: Database.Database): TextSummary[] {
  const rows = db.prepare(
    `SELECT t.id, t.title, t.updated_at,
            (SELECT COUNT(*) FROM sentences s WHERE s.text_id = t.id) AS sentence_count
     FROM texts t ORDER BY t.updated_at DESC`,
  ).all() as { id: string, title: string, updated_at: string, sentence_count: number }[]
  return rows.map(row => ({
    id: row.id,
    title: row.title ? JSON.parse(row.title) as MultiString : {},
    sentence_count: row.sentence_count,
    updated_at: row.updated_at,
  }))
}

export interface CreateTextResult {
  text: TextRecord
  created: boolean
  cursor: string | null
}

/**
 * Create a text with its ordered sentences. If `input.id` is a UUID that already
 * exists → idempotent no-op: returns the existing text with `created: false`
 * (edit via PATCH instead). Otherwise inserts the text + sentences (fractional
 * sort_keys assigned in array order) in one transaction.
 */
export function create_text({ db, history_db, user_id, api_key_id, input }: {
  db: Database.Database
  history_db?: Database.Database
  user_id: string
  api_key_id?: string | null
  input: TextCreateInput
}): CreateTextResult {
  const title = to_multistring(input.title)
  if (!title)
    throw new Error('text title is required')
  const text_id = resolve_client_id(input.id, { field: 'text id' })

  if (input.id) {
    const existing = get_text(db, text_id)
    if (existing)
      return { text: existing, created: false, cursor: read_last_modified_at(db) }
  }

  const now = new Date().toISOString()
  const source_slug_set = load_source_slug_set(db)
  const sentences = input.sentences ?? []
  const sort_keys = initial_keys(sentences.length)
  const events: HistoryEvent[] = []

  db.exec('BEGIN IMMEDIATE')
  try {
    const text_event = merge_dict_row({ db, table_name: 'texts', row: { id: text_id, title, created_at: now, updated_at: now }, user_id, at: now, api_key_id })
    if (text_event)
      events.push(text_event)
    sentences.forEach((sentence, index) => {
      const row = build_text_sentence_row({ sentence, text_id, sort_key: sort_keys[index], now, source_slug_set })
      const event = merge_dict_row({ db, table_name: 'sentences', row, user_id, at: now, api_key_id })
      if (event)
        events.push(event)
    })
    const cursor = read_last_modified_at(db)
    db.exec('COMMIT')
    commit_history(history_db, events)
    const text = get_text(db, text_id)
    if (!text)
      throw new Error('text vanished after create')
    return { text, created: true, cursor }
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

export interface UpdateTextResult extends SingleWriteResult {
  text?: TextRecord
}

/**
 * Field-merge a text: `title` overwrites; `append_sentences` are added after the
 * current last sentence; `sentence_order` (existing sentence ids) reassigns
 * sort_keys to the given order. Returns `found: false` if the text is gone. Edit
 * one sentence's text/translation/paragraph-break via `PATCH …/sentences/{id}`.
 */
export function apply_text_update({ db, history_db, text_id, patch, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  text_id: string
  patch: TextPatchInput
  user_id: string
  api_key_id?: string | null
}): UpdateTextResult {
  const existing_raw = db.prepare(`SELECT * FROM texts WHERE id = ?`).get(text_id) as Record<string, unknown> | undefined
  if (!existing_raw)
    return { found: false, new_synced_up_to: read_last_modified_at(db) }
  // Parse JSON columns before we re-merge them — merge_dict_row re-stringifies,
  // so feeding it a raw JSON string would double-encode it.
  const existing = parse_dict_row('texts', existing_raw)

  const now = new Date().toISOString()
  const source_slug_set = load_source_slug_set(db)
  const events: HistoryEvent[] = []
  const push = (table_name: 'texts' | 'sentences', row: Record<string, unknown>) => {
    const event = merge_dict_row({ db, table_name, row, user_id, at: now, api_key_id })
    if (event)
      events.push(event)
  }

  db.exec('BEGIN IMMEDIATE')
  try {
    if (patch.title !== undefined) {
      const title = to_multistring(patch.title)
      if (!title)
        throw new Error('text title cannot be empty')
      const row: Record<string, unknown> = { ...existing, title, updated_at: now }
      delete row.updated_by_user_id
      push('texts', row)
    }

    if (patch.append_sentences?.length) {
      const last = db.prepare(`SELECT sort_key FROM sentences WHERE text_id = ? ORDER BY sort_key DESC LIMIT 1`).get(text_id) as { sort_key: string | null } | undefined
      let prev = last?.sort_key ?? null
      for (const sentence of patch.append_sentences) {
        const sort_key = key_between(prev, null)
        push('sentences', build_text_sentence_row({ sentence, text_id, sort_key, now, source_slug_set }))
        prev = sort_key
      }
    }

    if (patch.sentence_order?.length) {
      const owned = new Set((db.prepare(`SELECT id FROM sentences WHERE text_id = ?`).all(text_id) as { id: string }[]).map(r => r.id))
      for (const id of patch.sentence_order) {
        if (!owned.has(id))
          throw new Error(`sentence ${id} is not part of this text`)
      }
      const keys = initial_keys(patch.sentence_order.length)
      patch.sentence_order.forEach((id, index) => {
        const row = parse_dict_row('sentences', db.prepare(`SELECT * FROM sentences WHERE id = ?`).get(id) as Record<string, unknown>)
        const next: Record<string, unknown> = { ...row, sort_key: keys[index], updated_at: now }
        delete next.updated_by_user_id
        push('sentences', next)
      })
    }

    const cursor = read_last_modified_at(db)
    db.exec('COMMIT')
    commit_history(history_db, events)
    return { found: true, new_synced_up_to: cursor, text: get_text(db, text_id) }
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

/**
 * Delete a text and ALL its sentences (a text-sentence is meaningless once
 * detached, and the FK is SET NULL — so we tombstone the sentences explicitly
 * first, then the text). Returns `found: false` if already gone.
 */
export function apply_text_delete({ db, history_db, text_id, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  text_id: string
  user_id: string
  api_key_id?: string | null
}): SingleWriteResult {
  const existing = db.prepare(`SELECT id FROM texts WHERE id = ?`).get(text_id) as { id: string } | undefined
  if (!existing)
    return { found: false, new_synced_up_to: read_last_modified_at(db) }

  const sentence_ids = (db.prepare(`SELECT id FROM sentences WHERE text_id = ?`).all(text_id) as { id: string }[]).map(r => r.id)
  for (const id of sentence_ids)
    run_tombstone_delete({ db, history_db, table_name: 'sentences', id, user_id, api_key_id })
  return run_tombstone_delete({ db, history_db, table_name: 'texts', id: text_id, user_id, api_key_id })
}

// ── Text classification tags (motif / genre / tale-type) ──────────────────────

export interface TextTagView { id: string, name: string, kind: string | null, code: string | null }

function tag_name_key(name: string): string {
  return name.trim().toLowerCase()
}

export function list_text_tags(db: Database.Database, text_id: string): TextTagView[] {
  return db.prepare(
    `SELECT t.id, t.name, t.kind, t.code
     FROM text_tags tt JOIN tags t ON t.id = tt.tag_id
     WHERE tt.text_id = ? ORDER BY t.name`,
  ).all(text_id) as TextTagView[]
}

/**
 * Attach a classification tag to a text, find-or-creating the tag by
 * (name, kind). Reuses the shared `tags` registry (with the `kind`/`code`
 * classification columns) and the `text_tags` junction. Idempotent per
 * (text, tag). Returns `found: false` if the text is gone.
 */
export function link_text_tag({ db, history_db, text_id, name, kind, code, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  text_id: string
  name: string
  kind?: string | null
  code?: string | null
  user_id: string
  api_key_id?: string | null
}): { tag?: TextTagView, found: boolean, created: boolean, cursor: string | null } {
  const trimmed = (name || '').trim()
  if (!trimmed)
    throw new Error('tag name is required')
  if (!(db.prepare(`SELECT 1 FROM texts WHERE id = ?`).get(text_id)))
    return { found: false, created: false, cursor: read_last_modified_at(db) }

  const now = new Date().toISOString()
  const events: HistoryEvent[] = []
  const push = (table_name: 'tags' | 'text_tags', row: Record<string, unknown>) => {
    const event = merge_dict_row({ db, table_name, row, user_id, at: now, api_key_id })
    if (event) events.push(event)
  }

  db.exec('BEGIN IMMEDIATE')
  try {
    const existing_tag = db.prepare(`SELECT id, name, kind, code FROM tags WHERE kind IS ? AND lower(trim(name)) = ?`).get(kind ?? null, tag_name_key(trimmed)) as TextTagView | undefined
    let tag: TextTagView
    let created = false
    if (existing_tag) {
      tag = existing_tag
    } else {
      const id = crypto.randomUUID()
      const row: Record<string, unknown> = { id, name: trimmed, created_at: now, updated_at: now }
      if (kind) row.kind = kind
      if (code) row.code = code
      push('tags', row)
      tag = { id, name: trimmed, kind: kind ?? null, code: code ?? null }
      created = true
    }

    const already = db.prepare(`SELECT id FROM text_tags WHERE text_id = ? AND tag_id = ?`).get(text_id, tag.id) as { id: string } | undefined
    if (!already)
      push('text_tags', { id: crypto.randomUUID(), text_id, tag_id: tag.id, created_at: now, updated_at: now })

    const cursor = read_last_modified_at(db)
    db.exec('COMMIT')
    commit_history(history_db, events)
    return { tag, found: true, created, cursor }
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

/** Unlink ONE tag from ONE text (the tag itself, and its other links, survive). */
export function unlink_text_tag({ db, history_db, text_id, tag_id, user_id, api_key_id }: {
  db: Database.Database
  history_db?: Database.Database
  text_id: string
  tag_id: string
  user_id: string
  api_key_id?: string | null
}): SingleWriteResult {
  const junction = db.prepare(`SELECT id FROM text_tags WHERE text_id = ? AND tag_id = ?`).get(text_id, tag_id) as { id: string } | undefined
  if (!junction)
    return { found: false, new_synced_up_to: read_last_modified_at(db) }
  return run_tombstone_delete({ db, history_db, table_name: 'text_tags', id: junction.id, user_id, api_key_id })
}
