import type { MultiString } from '$lib/types'
import type { SentenceToken, SentenceTokens } from '$lib/db/schemas/dictionary.types'
import { parse_dict_row, stringify_dict_row } from '$lib/db/schemas/dictionary-json-columns'
import { DICT_SYNCABLE_TABLES } from '$lib/db/dict-syncable-tables'
import { initial_keys } from '$lib/api/v1/fractional-index'
import { analyze_sentence_tokens, load_lexeme_index, tokens_reference_sense } from '$lib/corpus/sentence-analysis'
import type { LexemeIndex } from '$lib/corpus/match-tokens'
import { is_punctuation_form, normalized_word_key } from '$lib/corpus/tokenize-sentence'

/**
 * Worker-side atomic write orchestrators — LD's mirror of house's
 * `library-writes.ts`. Each function runs inside the leader worker against the
 * raw connection; the `dict_write` handler in `dict-instance.ts` wraps the
 * WHOLE call in `BEGIN/COMMIT` under the op-mutex, so a multi-statement
 * logical write (entry+sense, media+junction, …) is atomic as a group and can
 * never interleave with the sync engine's apply-transaction.
 *
 * Stamping (`dirty`/`updated_at`/audit columns, JSON stringification) lives
 * HERE — `DictLiveDb`'s insert/upsert delegate to the generic
 * `insert_rows`/`upsert_rows` ops, so there is exactly one insert code path.
 * Rows are returned PARSED (JSON columns as objects — structured clone
 * carries them back to the calling tab).
 *
 * Ids: the `DictLiveDb.writes` facade pre-generates the PRIMARY row's id
 * CLIENT-side (worker-side generation is only a fallback). This matters for
 * the at-least-once edge across a leader hand-off: if the old leader applies
 * an op and dies before responding, the transport re-sends it to the new
 * leader — with a client-stamped id the re-application collides on the PK and
 * the whole transaction fails LOUDLY (no duplicate); a fresh worker-side id
 * would silently create a second row. Junction link/unlink and upserts are
 * naturally idempotent on re-application.
 */

export interface DictWriteConnection {
  query: <T>(sql: string, params?: unknown[]) => Promise<T[]>
  execute: (sql: string, params?: unknown[]) => Promise<void>
}

export interface DictWriteOutcome<T = unknown> {
  result: T
  /** Tables the handler broadcasts as `tables_changed`. */
  affected_tables: string[]
  /** Hard-deleted rows for the `rows_deleted` broadcast (search-index eviction). */
  deleted_rows?: { table_name: string, id: string }[]
}

const JUNCTION_TABLES = [
  'audio_speakers',
  'video_speakers',
  'entry_tags',
  'entry_dialects',
  'senses_in_sentences',
  'sense_photos',
  'sense_videos',
  'sentence_photos',
  'sentence_videos',
  'section_sentences',
  'text_tags',
  'text_dialects',
] as const
export type JunctionTable = typeof JUNCTION_TABLES[number]

const IDENTIFIER_MATCH = /^\w+$/

function is_syncable(table: string): boolean {
  return (DICT_SYNCABLE_TABLES as readonly string[]).includes(table)
}

function assert_junction_table(table: string): asserts table is JunctionTable {
  if (!(JUNCTION_TABLES as readonly string[]).includes(table))
    throw new Error(`dict_write: "${table}" is not a junction table`)
}

/** Build `WHERE col_a = ? AND col_b = ?` from a natural-key object. */
function key_clause(key: Record<string, string>): { where: string, params: string[] } {
  const columns = Object.keys(key)
  if (columns.length === 0)
    throw new Error('dict_write: junction key must have at least one column')
  for (const column of columns) {
    if (!IDENTIFIER_MATCH.test(column))
      throw new Error(`dict_write: invalid key column "${column}"`)
  }
  return {
    where: columns.map(column => `"${column}" = ?`).join(' AND '),
    params: columns.map(column => key[column]),
  }
}

// All dict.db content tables carry a synthetic UUID `id`; the probe exists for
// the metadata tables (`db_metadata`, `deletes`). Schema is fixed per worker
// lifetime, so a module-level cache is safe.
const id_column_cache = new Map<string, boolean>()
async function table_has_id_column({ connection, table }: { connection: DictWriteConnection, table: string }): Promise<boolean> {
  const cached = id_column_cache.get(table)
  if (cached !== undefined)
    return cached
  const columns = await connection.query<{ name: string }>(`PRAGMA table_info("${table}")`)
  const has_id = columns.some(column => column.name === 'id')
  id_column_cache.set(table, has_id)
  return has_id
}

/** Stamp + INSERT one row; returns the parsed echo of what landed. */
async function insert_row({ connection, table, row, user_id }: {
  connection: DictWriteConnection
  table: string
  row: Record<string, unknown>
  user_id?: string
}): Promise<Record<string, unknown>> {
  const row_data = { ...row }
  const has_id_column = await table_has_id_column({ connection, table })
  if (has_id_column && !row_data.id)
    row_data.id = crypto.randomUUID()
  if (is_syncable(table)) {
    if (row_data.dirty === undefined)
      row_data.dirty = 1
    if (!row_data.updated_at)
      row_data.updated_at = new Date().toISOString()
    if (!row_data.created_at)
      row_data.created_at = row_data.updated_at
    if (user_id) {
      if (row_data.created_by_user_id === undefined)
        row_data.created_by_user_id = user_id
      if (row_data.updated_by_user_id === undefined)
        row_data.updated_by_user_id = user_id
    }
  }
  const stringified = stringify_dict_row(table, { ...row_data })
  const columns = Object.keys(stringified)
  await connection.execute(
    `INSERT INTO "${table}" (${columns.map(column => `"${column}"`).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    columns.map(column => stringified[column]),
  )
  if (has_id_column && row_data.id) {
    const echo = await connection.query<Record<string, unknown>>(`SELECT * FROM "${table}" WHERE id = ?`, [row_data.id])
    if (echo[0])
      return parse_dict_row(table, echo[0])
  }
  return row_data
}

/** Generic multi-row insert (the worker-side body of `DictLiveDb.insert`). */
export async function insert_rows_local({ connection, user_id, table, rows }: {
  connection: DictWriteConnection
  user_id?: string
  table: string
  rows: Record<string, unknown>[]
}): Promise<DictWriteOutcome<Record<string, unknown>[]>> {
  const results: Record<string, unknown>[] = []
  for (const row of rows)
    results.push(await insert_row({ connection, table, row, user_id }))
  return { result: results, affected_tables: rows.length ? [table] : [] }
}

/** Generic multi-row upsert (the worker-side body of `DictLiveDb.upsert`). */
export async function upsert_rows_local({ connection, user_id, table, rows }: {
  connection: DictWriteConnection
  user_id?: string
  table: string
  rows: Record<string, unknown>[]
}): Promise<DictWriteOutcome<null>> {
  for (const row of rows) {
    const row_data = { ...row }
    if (is_syncable(table)) {
      if (row_data.dirty === undefined)
        row_data.dirty = 1
      if (!row_data.updated_at)
        row_data.updated_at = new Date().toISOString()
      if (user_id) {
        if (row_data.created_by_user_id === undefined)
          row_data.created_by_user_id = user_id
        if (row_data.updated_by_user_id === undefined)
          row_data.updated_by_user_id = user_id
      }
    }
    const stringified = stringify_dict_row(table, { ...row_data })
    const columns = Object.keys(stringified)
    await connection.execute(
      `INSERT INTO "${table}" (${columns.map(column => `"${column}"`).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})
       ON CONFLICT(id) DO UPDATE SET ${columns.map(column => `"${column}" = excluded."${column}"`).join(', ')}`,
      columns.map(column => stringified[column]),
    )
  }
  return { result: null, affected_tables: rows.length ? [table] : [] }
}

/** New entry + its first (empty) sense. */
export async function insert_entry_local({ connection, user_id, lexeme, entry_id }: {
  connection: DictWriteConnection
  user_id?: string
  lexeme: MultiString
  /** Client-generated (see the ids note in the header) — worker generates only as a fallback. */
  entry_id?: string
}): Promise<DictWriteOutcome<Record<string, unknown>>> {
  const entry = await insert_row({ connection, table: 'entries', row: { id: entry_id, lexeme }, user_id })
  await insert_row({ connection, table: 'senses', row: { entry_id: entry.id }, user_id })
  return { result: entry, affected_tables: ['entries', 'senses'] }
}

/**
 * Word→entry matching (.issues/texts-sentences-pipeline.md M3): compute the
 * `tokens` value for a new/edited sentence text. The lexeme index is loaded
 * lazily ONCE per orchestrator call and reused across rows.
 */
async function tokens_for_sentence({ connection, text, existing_tokens, index_cache }: {
  connection: DictWriteConnection
  text: unknown
  existing_tokens?: unknown
  index_cache: { index?: LexemeIndex }
}): Promise<SentenceTokens | null> {
  if (!text || typeof text !== 'object')
    return (existing_tokens as SentenceTokens) ?? null
  index_cache.index ??= await load_lexeme_index(connection)
  const { tokens } = analyze_sentence_tokens({
    text: text as MultiString,
    existing_tokens: (existing_tokens as SentenceTokens) ?? null,
    index: index_cache.index,
  })
  return tokens
}

/** Stamp + UPDATE a sentence's `tokens` column (JSON). */
async function write_sentence_tokens({ connection, user_id, sentence_id, tokens }: {
  connection: DictWriteConnection
  user_id?: string
  sentence_id: string
  tokens: SentenceTokens | null
}): Promise<void> {
  const params: unknown[] = [tokens ? JSON.stringify(tokens) : null, new Date().toISOString()]
  let set_clause = `tokens = ?, dirty = 1, updated_at = ?`
  if (user_id) {
    set_clause += `, updated_by_user_id = ?`
    params.push(user_id)
  }
  params.push(sentence_id)
  await connection.execute(`UPDATE sentences SET ${set_clause} WHERE id = ?`, params)
}

/**
 * Drop `senses_in_sentences` rows whose token link vanished. TEXT sentences
 * only — a standalone sentence's junction row may be a curated example link
 * that predates tokens, so those are never auto-removed.
 */
async function cleanup_sense_links({ connection, sentence_id, text_id, tokens, sense_ids }: {
  connection: DictWriteConnection
  sentence_id: string
  text_id: unknown
  tokens: SentenceTokens | null
  sense_ids: string[]
}): Promise<{ affected_tables: string[], deleted_rows: { table_name: string, id: string }[] }> {
  if (!text_id || !sense_ids.length)
    return { affected_tables: [], deleted_rows: [] }
  const deleted_rows: { table_name: string, id: string }[] = []
  for (const sense_id of new Set(sense_ids)) {
    if (tokens_reference_sense({ tokens, sense_id }))
      continue
    const existing = await connection.query<{ id: string }>(
      `SELECT id FROM senses_in_sentences WHERE sentence_id = ? AND sense_id = ?`,
      [sentence_id, sense_id],
    )
    if (!existing[0])
      continue
    await connection.execute(`INSERT OR IGNORE INTO deletes (table_name, id) VALUES (?, ?)`, ['senses_in_sentences', existing[0].id])
    deleted_rows.push({ table_name: 'senses_in_sentences', id: existing[0].id })
  }
  if (!deleted_rows.length)
    return { affected_tables: [], deleted_rows: [] }
  return { affected_tables: ['senses_in_sentences', 'deletes'], deleted_rows }
}

/** New sentence linked to a sense. */
export async function insert_sentence_local({ connection, user_id, sentence, sense_id }: {
  connection: DictWriteConnection
  user_id?: string
  sentence: Record<string, unknown>
  sense_id: string
}): Promise<DictWriteOutcome<Record<string, unknown>>> {
  const index_cache = {}
  const tokens = await tokens_for_sentence({ connection, text: sentence.text, existing_tokens: sentence.tokens, index_cache })
  const new_sentence = await insert_row({ connection, table: 'sentences', row: { ...sentence, ...(tokens ? { tokens } : {}) }, user_id })
  await insert_row({ connection, table: 'senses_in_sentences', row: { sentence_id: new_sentence.id, sense_id }, user_id })
  return { result: new_sentence, affected_tables: ['sentences', 'senses_in_sentences'] }
}

/** Bulk sentence insert (text append / standalone add) with auto-matching. */
export async function insert_sentences_local({ connection, user_id, rows }: {
  connection: DictWriteConnection
  user_id?: string
  rows: Record<string, unknown>[]
}): Promise<DictWriteOutcome<Record<string, unknown>[]>> {
  const index_cache = {}
  const results: Record<string, unknown>[] = []
  for (const row of rows) {
    const tokens = await tokens_for_sentence({ connection, text: row.text, existing_tokens: row.tokens, index_cache })
    results.push(await insert_row({ connection, table: 'sentences', row: { ...row, ...(tokens ? { tokens } : {}) }, user_id }))
  }
  return { result: results, affected_tables: rows.length ? ['sentences'] : [] }
}

/**
 * New text + its ordered sentences (fractional sort_keys assigned in array
 * order) — the local-first mirror of the server's `v1-texts.create_text`.
 * Each sentence is tokenized + auto-matched on the way in.
 */
export async function insert_text_local({ connection, user_id, text_id, title, sentences }: {
  connection: DictWriteConnection
  user_id?: string
  /** Client-generated (see the ids note in the header) — worker generates only as a fallback. */
  text_id?: string
  title: MultiString
  sentences: { text: MultiString, ends_paragraph?: number }[]
}): Promise<DictWriteOutcome<Record<string, unknown>>> {
  const text = await insert_row({ connection, table: 'texts', row: { id: text_id, title }, user_id })
  const sort_keys = initial_keys(sentences.length)
  const index_cache = {}
  for (const [index, sentence] of sentences.entries()) {
    const tokens = await tokens_for_sentence({ connection, text: sentence.text, index_cache })
    await insert_row({
      connection,
      table: 'sentences',
      row: {
        text: sentence.text,
        text_id: text.id,
        sort_key: sort_keys[index],
        ...tokens ? { tokens } : {},
        ...sentence.ends_paragraph ? { ends_paragraph: 1 } : {},
      },
      user_id,
    })
  }
  return { result: text, affected_tables: sentences.length ? ['texts', 'sentences'] : ['texts'] }
}

/**
 * Patch a sentence row (worker-side twin of the generic table update, plus:
 * when `text` changes the tokens are recomputed in the SAME transaction —
 * carry-over preserves confirmed/gold-IGT tokens by normalized form; vanished
 * forms drop their token and clean their junction rows).
 */
export async function update_sentence_local({ connection, user_id, sentence }: {
  connection: DictWriteConnection
  user_id?: string
  sentence: Record<string, unknown> & { id: string }
}): Promise<DictWriteOutcome<Record<string, unknown>>> {
  const { id, ...patch } = sentence
  if (!id)
    throw new Error('update_sentence: id is required')
  const [existing] = await connection.query<Record<string, unknown>>(`SELECT * FROM sentences WHERE id = ?`, [id])
  if (!existing)
    throw new Error('update_sentence: sentence not found')

  const stamped: Record<string, unknown> = { ...patch, dirty: 1, updated_at: new Date().toISOString() }
  if (user_id)
    stamped.updated_by_user_id = user_id
  const stringified = stringify_dict_row('sentences', { ...stamped })
  const columns = Object.keys(stringified)
  await connection.execute(
    `UPDATE sentences SET ${columns.map(column => `"${column}" = ?`).join(', ')} WHERE id = ?`,
    [...columns.map(column => stringified[column]), id],
  )

  const affected_tables = ['sentences']
  let deleted_rows: { table_name: string, id: string }[] | undefined
  if ('text' in patch) {
    const parsed = parse_dict_row('sentences', { ...existing, ...stamped })
    const index = await load_lexeme_index(connection)
    const analysis = analyze_sentence_tokens({
      text: parsed.text as MultiString | null,
      existing_tokens: (parsed.tokens as SentenceTokens) ?? null,
      index,
    })
    if (analysis.changed) {
      await write_sentence_tokens({ connection, user_id, sentence_id: id, tokens: analysis.tokens })
      const cleanup = await cleanup_sense_links({
        connection,
        sentence_id: id,
        text_id: existing.text_id,
        tokens: analysis.tokens,
        sense_ids: analysis.dropped_sense_ids,
      })
      affected_tables.push(...cleanup.affected_tables)
      if (cleanup.deleted_rows.length)
        ({ deleted_rows } = cleanup)
    }
  }

  const [echo] = await connection.query<Record<string, unknown>>(`SELECT * FROM sentences WHERE id = ?`, [id])
  return { result: parse_dict_row('sentences', echo), affected_tables, ...(deleted_rows ? { deleted_rows } : {}) }
}

/**
 * Tokenize + auto-match sentences (a whole text or an explicit id list).
 * Idempotent: rows whose analysis reproduces the stored tokens are untouched
 * (no dirty churn — gold IGT sentences survive byte-identically).
 */
export async function analyze_sentences_local({ connection, user_id, text_id, sentence_ids }: {
  connection: DictWriteConnection
  user_id?: string
  text_id?: string
  sentence_ids?: string[]
}): Promise<DictWriteOutcome<{ analyzed: number, changed: number }>> {
  let rows: Record<string, unknown>[]
  if (text_id) {
    rows = await connection.query(`SELECT * FROM sentences WHERE text_id = ?`, [text_id])
  } else if (sentence_ids?.length) {
    rows = await connection.query(
      `SELECT * FROM sentences WHERE id IN (${sentence_ids.map(() => '?').join(', ')})`,
      sentence_ids,
    )
  } else {
    throw new Error('analyze_sentences: text_id or sentence_ids required')
  }

  const index = await load_lexeme_index(connection)
  const affected = new Set<string>()
  const deleted_rows: { table_name: string, id: string }[] = []
  let changed = 0
  for (const raw of rows) {
    const row = parse_dict_row('sentences', { ...raw })
    const analysis = analyze_sentence_tokens({
      text: row.text as MultiString | null,
      existing_tokens: (row.tokens as SentenceTokens) ?? null,
      index,
    })
    if (!analysis.changed)
      continue
    changed++
    affected.add('sentences')
    await write_sentence_tokens({ connection, user_id, sentence_id: row.id as string, tokens: analysis.tokens })
    const cleanup = await cleanup_sense_links({
      connection,
      sentence_id: row.id as string,
      text_id: row.text_id,
      tokens: analysis.tokens,
      sense_ids: analysis.dropped_sense_ids,
    })
    for (const table of cleanup.affected_tables) affected.add(table)
    deleted_rows.push(...cleanup.deleted_rows)
  }
  return {
    result: { analyzed: rows.length, changed },
    affected_tables: [...affected],
    ...(deleted_rows.length ? { deleted_rows } : {}),
  }
}

export type TokenLinkAction = 'confirm' | 'ignore' | 'unlink'

/**
 * Human review actions on one token: confirm a match (optionally to a sense —
 * mirrored into `senses_in_sentences`), link a different entry (same shape),
 * ignore, or unlink back to unmatched. Gold IGT metadata (gloss/morphemes)
 * always survives.
 */
export async function set_token_link_local({ connection, user_id, sentence_id, orthography, token_index, action, entry_id, sense_id }: {
  connection: DictWriteConnection
  user_id?: string
  sentence_id: string
  orthography: string
  token_index: number
  action: TokenLinkAction
  entry_id?: string
  sense_id?: string
}): Promise<DictWriteOutcome<Record<string, unknown>>> {
  const [raw] = await connection.query<Record<string, unknown>>(`SELECT * FROM sentences WHERE id = ?`, [sentence_id])
  if (!raw)
    throw new Error('set_token_link: sentence not found')
  const row = parse_dict_row('sentences', raw)
  const tokens = (row.tokens ?? {}) as SentenceTokens
  const list = tokens[orthography]
  const token = list?.[token_index]
  if (!token)
    throw new Error('set_token_link: token not found')

  const previous_sense_id = token.sense_id
  const base: SentenceToken = { form: token.form, start: token.start, end: token.end }
  if (token.gloss)
    base.gloss = token.gloss
  if (token.morphemes)
    base.morphemes = token.morphemes
  if (action === 'confirm') {
    if (!entry_id)
      throw new Error('set_token_link: entry_id required to confirm')
    list[token_index] = { ...base, entry_id, ...(sense_id ? { sense_id } : {}), status: 'confirmed' }
  } else if (action === 'ignore') {
    list[token_index] = { ...base, status: 'ignored' }
  } else {
    list[token_index] = base
  }

  await write_sentence_tokens({ connection, user_id, sentence_id, tokens })
  const affected_tables = ['sentences']
  const deleted_rows: { table_name: string, id: string }[] = []

  if (action === 'confirm' && sense_id) {
    const existing = await connection.query<{ id: string }>(
      `SELECT id FROM senses_in_sentences WHERE sentence_id = ? AND sense_id = ?`,
      [sentence_id, sense_id],
    )
    if (!existing[0]) {
      await insert_row({ connection, table: 'senses_in_sentences', row: { sentence_id, sense_id }, user_id })
      affected_tables.push('senses_in_sentences')
    }
  }
  if (previous_sense_id && previous_sense_id !== sense_id) {
    const cleanup = await cleanup_sense_links({
      connection,
      sentence_id,
      text_id: row.text_id,
      tokens,
      sense_ids: [previous_sense_id],
    })
    for (const table of cleanup.affected_tables) {
      if (!affected_tables.includes(table))
        affected_tables.push(table)
    }
    deleted_rows.push(...cleanup.deleted_rows)
  }

  const [echo] = await connection.query<Record<string, unknown>>(`SELECT * FROM sentences WHERE id = ?`, [sentence_id])
  return {
    result: parse_dict_row('sentences', echo),
    affected_tables,
    ...(deleted_rows.length ? { deleted_rows } : {}),
  }
}

/**
 * New entry (+ first sense) minted from an unmatched token, confirmed against
 * that sense in the same transaction.
 */
export async function create_entry_from_token_local({ connection, user_id, lexeme, entry_id, sentence_id, orthography, token_index }: {
  connection: DictWriteConnection
  user_id?: string
  lexeme: MultiString
  /** Client-generated (see the ids note in the header) — worker generates only as a fallback. */
  entry_id?: string
  sentence_id: string
  orthography: string
  token_index: number
}): Promise<DictWriteOutcome<Record<string, unknown>>> {
  const entry = await insert_row({ connection, table: 'entries', row: { id: entry_id, lexeme }, user_id })
  const sense = await insert_row({ connection, table: 'senses', row: { entry_id: entry.id }, user_id })
  const link = await set_token_link_local({
    connection,
    user_id,
    sentence_id,
    orthography,
    token_index,
    action: 'confirm',
    entry_id: entry.id as string,
    sense_id: sense.id as string,
  })
  const affected_tables = ['entries', 'senses', ...link.affected_tables.filter(table => !['entries', 'senses'].includes(table))]
  return { result: entry, affected_tables, ...(link.deleted_rows?.length ? { deleted_rows: link.deleted_rows } : {}) }
}

/**
 * "Ignore everywhere": mark every non-confirmed occurrence of a form
 * (normalized-word equality) as `ignored` across all tokenized sentences.
 */
export async function ignore_form_local({ connection, user_id, form }: {
  connection: DictWriteConnection
  user_id?: string
  form: string
}): Promise<DictWriteOutcome<{ sentences_changed: number, occurrences: number }>> {
  const key = normalized_word_key(form)
  if (!key)
    throw new Error('ignore_form: form has no word characters')
  const rows = await connection.query<{ id: string, tokens: string }>(
    `SELECT id, tokens FROM sentences WHERE tokens IS NOT NULL`,
  )
  let sentences_changed = 0
  let occurrences = 0
  for (const raw of rows) {
    let tokens: SentenceTokens
    try {
      tokens = JSON.parse(raw.tokens)
    } catch {
      continue
    }
    let changed = false
    for (const list of Object.values(tokens)) {
      for (const [index, token] of list.entries()) {
        if (token.status === 'confirmed' || token.sense_id || is_punctuation_form(token.form))
          continue
        if (token.status === 'ignored' && !token.entry_id && !token.candidates)
          continue // already exactly ignored — avoid dirty churn
        if (normalized_word_key(token.form) !== key)
          continue
        const replacement: SentenceToken = { form: token.form, start: token.start, end: token.end, status: 'ignored' }
        if (token.gloss)
          replacement.gloss = token.gloss
        if (token.morphemes)
          replacement.morphemes = token.morphemes
        list[index] = replacement
        changed = true
        occurrences++
      }
    }
    if (changed) {
      sentences_changed++
      await write_sentence_tokens({ connection, user_id, sentence_id: raw.id, tokens })
    }
  }
  return {
    result: { sentences_changed, occurrences },
    affected_tables: sentences_changed ? ['sentences'] : [],
  }
}

/** New audio row (+ optional speaker junction in the same transaction). */
export async function insert_audio_local({ connection, user_id, audio, speaker_id }: {
  connection: DictWriteConnection
  user_id?: string
  audio: Record<string, unknown>
  speaker_id?: string
}): Promise<DictWriteOutcome<Record<string, unknown>>> {
  const new_audio = await insert_row({ connection, table: 'audio', row: audio, user_id })
  const affected_tables = ['audio']
  if (speaker_id) {
    await insert_row({ connection, table: 'audio_speakers', row: { audio_id: new_audio.id, speaker_id }, user_id })
    affected_tables.push('audio_speakers')
  }
  return { result: new_audio, affected_tables }
}

/** New photo linked to a sense. */
export async function insert_photo_local({ connection, user_id, photo, sense_id }: {
  connection: DictWriteConnection
  user_id?: string
  photo: Record<string, unknown>
  sense_id: string
}): Promise<DictWriteOutcome<Record<string, unknown>>> {
  const new_photo = await insert_row({ connection, table: 'photos', row: photo, user_id })
  await insert_row({ connection, table: 'sense_photos', row: { photo_id: new_photo.id, sense_id }, user_id })
  return { result: new_photo, affected_tables: ['photos', 'sense_photos'] }
}

/** New video linked to a sense (+ optional speaker junction). */
export async function insert_video_local({ connection, user_id, video, sense_id, speaker_id }: {
  connection: DictWriteConnection
  user_id?: string
  video: Record<string, unknown>
  sense_id: string
  speaker_id?: string
}): Promise<DictWriteOutcome<Record<string, unknown>>> {
  const new_video = await insert_row({ connection, table: 'videos', row: video, user_id })
  await insert_row({ connection, table: 'sense_videos', row: { video_id: new_video.id, sense_id }, user_id })
  const affected_tables = ['videos', 'sense_videos']
  if (speaker_id) {
    await insert_row({ connection, table: 'video_speakers', row: { video_id: new_video.id, speaker_id }, user_id })
    affected_tables.push('video_speakers')
  }
  return { result: new_video, affected_tables }
}

/**
 * Add a junction link keyed by its natural key — atomic check-then-insert
 * (the old main-thread version could race a sync pull between the read and
 * the write). No-op if the link already exists.
 */
export async function link_junction_local({ connection, user_id, table, key }: {
  connection: DictWriteConnection
  user_id?: string
  table: string
  key: Record<string, string>
}): Promise<DictWriteOutcome<{ linked: boolean }>> {
  assert_junction_table(table)
  const { where, params } = key_clause(key)
  const existing = await connection.query<{ id: string }>(`SELECT id FROM "${table}" WHERE ${where}`, params)
  if (existing[0])
    return { result: { linked: false }, affected_tables: [] }
  await insert_row({ connection, table, row: { ...key }, user_id })
  return { result: { linked: true }, affected_tables: [table] }
}

/**
 * Hard-delete a junction link by natural key: the `deletes` tombstone fires
 * `process_delete_cascade`, which DELETEs the junction row (the tombstone
 * stays as the durable delete log + sync push queue). No-op if absent.
 */
export async function unlink_junction_local({ connection, table, key }: {
  connection: DictWriteConnection
  table: string
  key: Record<string, string>
}): Promise<DictWriteOutcome<{ unlinked: boolean }>> {
  assert_junction_table(table)
  const { where, params } = key_clause(key)
  const existing = await connection.query<{ id: string }>(`SELECT id FROM "${table}" WHERE ${where}`, params)
  if (!existing[0])
    return { result: { unlinked: false }, affected_tables: [] }
  await connection.execute(`INSERT OR IGNORE INTO deletes (table_name, id) VALUES (?, ?)`, [table, existing[0].id])
  return {
    result: { unlinked: true },
    affected_tables: [table, 'deletes'],
    deleted_rows: [{ table_name: table, id: existing[0].id }],
  }
}

const DICT_WRITE_OPS = {
  insert_rows: insert_rows_local,
  upsert_rows: upsert_rows_local,
  insert_entry: insert_entry_local,
  insert_sentence: insert_sentence_local,
  insert_sentences: insert_sentences_local,
  update_sentence: update_sentence_local,
  analyze_sentences: analyze_sentences_local,
  set_token_link: set_token_link_local,
  create_entry_from_token: create_entry_from_token_local,
  ignore_form: ignore_form_local,
  insert_text: insert_text_local,
  insert_audio: insert_audio_local,
  insert_photo: insert_photo_local,
  insert_video: insert_video_local,
  link_junction: link_junction_local,
  unlink_junction: unlink_junction_local,
} as const

export type DictWriteOp = keyof typeof DICT_WRITE_OPS

export function dispatch_dict_write({ op, connection, args }: {
  op: string
  connection: DictWriteConnection
  args: Record<string, unknown>
}): Promise<DictWriteOutcome> {
  const orchestrator = DICT_WRITE_OPS[op as DictWriteOp]
  if (!orchestrator) {
    const err = new Error(`dict instance: unknown dict_write op ${op}`) as Error & { code: string }
    err.code = 'internal'
    throw err
  }
  return orchestrator({ connection, ...args } as never) as Promise<DictWriteOutcome>
}
