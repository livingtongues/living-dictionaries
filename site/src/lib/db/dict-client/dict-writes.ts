import type { MultiString } from '$lib/types'
import { parse_dict_row, stringify_dict_row } from '$lib/db/schemas/dictionary-json-columns'
import { DICT_SYNCABLE_TABLES } from '$lib/db/server/dictionary-sync-helpers'

/**
 * Worker-side atomic write orchestrators — LD's mirror of house's
 * `library-writes.ts`. Each function runs inside the leader worker against the
 * raw connection; the `dict_write` handler in `dict-instance.ts` wraps the
 * WHOLE call in `BEGIN/COMMIT` under the op-mutex, so a multi-statement
 * logical write (entry+sense, media+junction, …) is atomic as a group and can
 * never interleave with the sync engine's apply-transaction.
 *
 * Stamping (id generation, `dirty`/`updated_at`/audit columns, JSON
 * stringification) lives HERE — `DictLiveDb`'s insert/upsert delegate to the
 * generic `insert_rows`/`upsert_rows` ops, so there is exactly one insert code
 * path. Rows are returned PARSED (JSON columns as objects — structured clone
 * carries them back to the calling tab).
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
export async function insert_entry_local({ connection, user_id, lexeme }: {
  connection: DictWriteConnection
  user_id?: string
  lexeme: MultiString
}): Promise<DictWriteOutcome<Record<string, unknown>>> {
  const entry = await insert_row({ connection, table: 'entries', row: { lexeme }, user_id })
  await insert_row({ connection, table: 'senses', row: { entry_id: entry.id }, user_id })
  return { result: entry, affected_tables: ['entries', 'senses'] }
}

/** New sentence linked to a sense. */
export async function insert_sentence_local({ connection, user_id, sentence, sense_id }: {
  connection: DictWriteConnection
  user_id?: string
  sentence: Record<string, unknown>
  sense_id: string
}): Promise<DictWriteOutcome<Record<string, unknown>>> {
  const new_sentence = await insert_row({ connection, table: 'sentences', row: sentence, user_id })
  await insert_row({ connection, table: 'senses_in_sentences', row: { sentence_id: new_sentence.id, sense_id }, user_id })
  return { result: new_sentence, affected_tables: ['sentences', 'senses_in_sentences'] }
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
