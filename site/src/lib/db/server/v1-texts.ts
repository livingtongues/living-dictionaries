import type Database from 'better-sqlite3'
import type { HistoryEvent } from './dictionary-history-db'
import type { SingleWriteResult } from './v1-entry-write'
import type { SpeakerRecord } from './v1-sub-resources'
import type { SentenceIgtFields, SourceCitationInput } from '$lib/api/v1/entry-input'
import type { MediaTimings, SentenceTokens, SourceCitation } from '$lib/db/schemas/dictionary.types'
import type { MultiString } from '$lib/types'
import { resolve_client_id, to_multistring, to_string_array } from '$lib/api/v1/entry-input'
import { citation_slugs, resolve_sentence_igt, to_citations, to_discourse_role } from '$lib/api/v1/sentence-igt'
import { initial_keys, key_between } from '$lib/api/v1/fractional-index'
import { parse_dict_row } from '$lib/db/schemas/dictionary-json-columns'
import { read_last_modified_at } from './dictionary-db'
import { record_history } from './dictionary-history-db'
import { merge_dict_row } from './dictionary-sync-helpers'
import { assert_known_source_slugs, load_source_slug_set } from './source-slugs'
import { load_dialect_map, run_tombstone_delete } from './v1-entry-write'

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
  /** `sources.slug` refs — each must already exist. */
  sources?: string[] | string
  /** Source refs WITH a citation locus (page/hymn number). */
  citations?: SourceCitationInput[]
  /** Synopsis/abstract of the text, per language. */
  summary?: MultiString | string
  /** Dialect names — found-or-created, linked via `text_dialects`. */
  dialects?: string[] | string
  /** Grouping key: texts sharing a `work_id` are versions of ONE work (parallel
   *  texts across dialects). Supply your own stable id or reuse a sibling's. */
  work_id?: string
  sentences?: TextSentenceInput[]
}

export interface TextPatchInput {
  title?: MultiString | string
  /** Whole-array replace of the text's `sources.slug` refs. */
  sources?: string[] | string
  /** Whole-array replace of the citation loci. */
  citations?: SourceCitationInput[]
  /** Overwrites the summary; `null` clears. */
  summary?: MultiString | string | null
  /** ADDITIVE dialect links (found-or-created); unlink via the dialects UI/API. */
  dialects?: string[] | string
  /** Overwrites the parallel-text grouping key; `null` clears. */
  work_id?: string | null
  /** New sentences appended after the current last one, in array order. */
  append_sentences?: TextSentenceInput[]
  /** Full ordering of EXISTING sentence ids — sort_keys are reassigned to match. */
  sentence_order?: string[]
}

/** One audio row in the text READ shape (text- or sentence-level; owner implied by nesting). */
export interface TextAudioRecord {
  id: string
  storage_path: string | null
  source: string | null
  timings: MediaTimings | null
  /** Present only when a speaker is attached; full records in `TextRecord.speakers`. */
  speakers?: { id: string, name: string }[]
  created_at: string
  updated_at: string
  /** Absolute URL that redirects to the audio bytes — set by the route layer. */
  download_url?: string
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
  /** Present only when this sentence has attached audio. */
  audio?: TextAudioRecord[]
}

/** A sibling version of the same work (shared `work_id`). */
export interface ParallelTextRef {
  id: string
  title: MultiString
  dialects: { id: string, name: MultiString }[]
}

export interface TextRecord {
  id: string
  title: MultiString
  sources: string[] | null
  citations: SourceCitation[] | null
  summary: MultiString | null
  work_id: string | null
  updated_at: string
  sentences: TextSentenceRecord[]
  /** Dialects this text version is written in (via `text_dialects`). Present only when set. */
  dialects?: { id: string, name: MultiString }[]
  /** Other versions of the same work (same `work_id`). Present only when siblings exist. */
  parallel_texts?: ParallelTextRef[]
  /** Present only when TEXT-level audio exists (whole-passage recordings). */
  audio?: TextAudioRecord[]
  /** Full speaker records for every speaker referenced by the included audio. */
  speakers?: SpeakerRecord[]
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

function read_text_row(db: Database.Database, text_id: string): Pick<TextRecord, 'id' | 'title' | 'sources' | 'citations' | 'summary' | 'work_id' | 'updated_at'> | undefined {
  const row = db.prepare(`SELECT * FROM texts WHERE id = ?`).get(text_id) as Record<string, unknown> | undefined
  if (!row)
    return undefined
  const parsed = parse_dict_row('texts', row)
  return {
    id: parsed.id as string,
    title: (parsed.title as MultiString) ?? {},
    sources: (parsed.sources as string[]) ?? null,
    citations: (parsed.citations as SourceCitation[]) ?? null,
    summary: (parsed.summary as MultiString) ?? null,
    work_id: (parsed.work_id as string) ?? null,
    updated_at: parsed.updated_at as string,
  }
}

function list_text_dialects(db: Database.Database, text_id: string): { id: string, name: MultiString }[] {
  const rows = db.prepare(
    `SELECT d.id, d.name FROM text_dialects td JOIN dialects d ON d.id = td.dialect_id
     WHERE td.text_id = ? ORDER BY td.created_at`,
  ).all(text_id) as { id: string, name: string }[]
  return rows.map(row => ({ id: row.id, name: row.name ? JSON.parse(row.name) as MultiString : {} }))
}

/** Sibling versions of the same work — texts sharing this text's `work_id`. */
function list_parallel_texts(db: Database.Database, { text_id, work_id }: { text_id: string, work_id: string | null }): ParallelTextRef[] {
  if (!work_id)
    return []
  const rows = db.prepare(`SELECT id, title FROM texts WHERE work_id = ? AND id != ? ORDER BY created_at`).all(work_id, text_id) as { id: string, title: string | null }[]
  return rows.map(row => ({
    id: row.id,
    title: row.title ? JSON.parse(row.title) as MultiString : {},
    dialects: list_text_dialects(db, row.id),
  }))
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

function read_audio_records(db: Database.Database, rows: Record<string, unknown>[]): TextAudioRecord[] {
  return rows.map((raw) => {
    const row = parse_dict_row('audio', raw) as Record<string, any>
    const record: TextAudioRecord = {
      id: row.id,
      storage_path: row.storage_path ?? null,
      source: row.source ?? null,
      timings: (row.timings as MediaTimings) ?? null,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }
    const speakers = db.prepare(
      `SELECT sp.id, sp.name FROM speakers sp
         JOIN audio_speakers j ON j.speaker_id = sp.id
        WHERE j.audio_id = ? ORDER BY sp.name`,
    ).all(row.id) as { id: string, name: string }[]
    if (speakers.length)
      record.speakers = speakers
    return record
  })
}

/** Attach text- and sentence-level audio (+ deduped full speaker records) to a text read. */
function include_text_audio(db: Database.Database, text: TextRecord): void {
  const text_audio = read_audio_records(db, db.prepare(`SELECT * FROM audio WHERE text_id = ? ORDER BY created_at`).all(text.id) as Record<string, unknown>[])
  if (text_audio.length)
    text.audio = text_audio

  const all_audio = [...text_audio]
  for (const sentence of text.sentences) {
    const sentence_audio = read_audio_records(db, db.prepare(`SELECT * FROM audio WHERE sentence_id = ? ORDER BY created_at`).all(sentence.id) as Record<string, unknown>[])
    if (sentence_audio.length) {
      sentence.audio = sentence_audio
      all_audio.push(...sentence_audio)
    }
  }

  const speaker_ids = [...new Set(all_audio.flatMap(audio => audio.speakers?.map(speaker => speaker.id) ?? []))]
  if (speaker_ids.length) {
    text.speakers = db.prepare(
      `SELECT id, name, decade, gender, birthplace FROM speakers WHERE id IN (${speaker_ids.map(() => '?').join(', ')}) ORDER BY name`,
    ).all(...speaker_ids) as SpeakerRecord[]
  }
}

export function get_text(db: Database.Database, text_id: string): TextRecord | undefined {
  const text = read_text_row(db, text_id)
  if (!text)
    return undefined
  const record: TextRecord = { ...text, sentences: list_text_sentences(db, text_id) }
  const dialects = list_text_dialects(db, text_id)
  if (dialects.length)
    record.dialects = dialects
  const parallel_texts = list_parallel_texts(db, { text_id, work_id: text.work_id })
  if (parallel_texts.length)
    record.parallel_texts = parallel_texts
  include_text_audio(db, record)
  return record
}

/**
 * Stamp each included audio record with the absolute `download_url` a consumer
 * fetches the bytes from (`GET …/media/{storage_path}` — redirects to storage).
 * Route-layer concern: only the route knows the request origin.
 */
export function add_audio_download_urls({ text, origin, dict_id }: { text: TextRecord, origin: string, dict_id: string }): TextRecord {
  const stamp = (records?: TextAudioRecord[]) => {
    for (const record of records ?? []) {
      if (record.storage_path)
        record.download_url = `${origin}/api/v1/dictionaries/${dict_id}/media/${record.storage_path.split('/').map(encodeURIComponent).join('/')}`
    }
  }
  stamp(text.audio)
  for (const sentence of text.sentences)
    stamp(sentence.audio)
  return text
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

/**
 * ADDITIVE dialect links for a text (found-or-created by name, deduped) — the
 * text twin of the entry write path's dialect handling. Runs inside the caller's
 * open transaction; new rows' history events are appended to `events`.
 */
function link_text_dialects({ db, text_id, dialects, now, user_id, api_key_id, events }: {
  db: Database.Database
  text_id: string
  dialects: string[] | string | undefined
  now: string
  user_id: string
  api_key_id?: string | null
  events: HistoryEvent[]
}): void {
  const names = to_string_array(dialects)
  if (!names)
    return
  const dialect_map = load_dialect_map(db)
  const linked = new Set((db.prepare(`SELECT dialect_id FROM text_dialects WHERE text_id = ?`).all(text_id) as { dialect_id: string }[]).map(row => row.dialect_id))
  const push = (table_name: 'dialects' | 'text_dialects', row: Record<string, unknown>) => {
    const event = merge_dict_row({ db, table_name, row, user_id, at: now, api_key_id })
    if (event)
      events.push(event)
  }
  for (const raw of names) {
    const key = raw.trim().toLowerCase()
    let id = dialect_map.get(key)
    if (!id) {
      id = crypto.randomUUID()
      dialect_map.set(key, id)
      push('dialects', { id, name: { default: raw.trim() }, created_at: now, updated_at: now })
    }
    if (!linked.has(id)) {
      push('text_dialects', { id: crypto.randomUUID(), text_id, dialect_id: id, created_at: now, updated_at: now })
      linked.add(id)
    }
  }
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

  const sources = to_string_array(input.sources)
  assert_known_source_slugs(sources, source_slug_set)
  const citations = to_citations(input.citations)
  assert_known_source_slugs(citation_slugs(citations), source_slug_set)
  const summary = to_multistring(input.summary)
  const work_id = typeof input.work_id === 'string' && input.work_id.trim() ? input.work_id.trim() : undefined

  db.exec('BEGIN IMMEDIATE')
  try {
    const text_row: Record<string, unknown> = { id: text_id, title, created_at: now, updated_at: now }
    if (sources) text_row.sources = sources
    if (citations) text_row.citations = citations
    if (summary) text_row.summary = summary
    if (work_id) text_row.work_id = work_id
    const text_event = merge_dict_row({ db, table_name: 'texts', row: text_row, user_id, at: now, api_key_id })
    if (text_event)
      events.push(text_event)
    link_text_dialects({ db, text_id, dialects: input.dialects, now, user_id, api_key_id, events })
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
 * Field-merge a text: `title`/`sources`/`citations`/`summary`/`work_id`
 * overwrite (null clears the nullable ones); `dialects` are ADDITIVE links
 * (found-or-created); `append_sentences` are added after the current last
 * sentence; `sentence_order` (existing sentence ids) reassigns sort_keys to the
 * given order. Returns `found: false` if the text is gone. Edit one sentence's
 * text/translation/paragraph-break via `PATCH …/sentences/{id}`.
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
    const patch_source = patch as Record<string, unknown>
    const row: Record<string, unknown> = { ...existing, updated_at: now }
    delete row.updated_by_user_id
    let text_row_changed = false
    if (patch.title !== undefined) {
      const title = to_multistring(patch.title)
      if (!title)
        throw new Error('text title cannot be empty')
      row.title = title
      text_row_changed = true
    }
    if ('sources' in patch_source) {
      const sources = to_string_array(patch.sources) ?? null
      assert_known_source_slugs(sources ?? undefined, source_slug_set)
      row.sources = sources
      text_row_changed = true
    }
    if ('citations' in patch_source) {
      const citations = to_citations(patch.citations)
      assert_known_source_slugs(citation_slugs(citations), source_slug_set)
      row.citations = citations ?? null
      text_row_changed = true
    }
    if ('summary' in patch_source) {
      row.summary = to_multistring(patch.summary) ?? null
      text_row_changed = true
    }
    if ('work_id' in patch_source) {
      row.work_id = typeof patch.work_id === 'string' && patch.work_id.trim() ? patch.work_id.trim() : null
      text_row_changed = true
    }
    if (text_row_changed)
      push('texts', row)

    link_text_dialects({ db, text_id, dialects: patch.dialects, now, user_id, api_key_id, events })

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
