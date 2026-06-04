import { parse_dict_row } from '$lib/db/schemas/dictionary-json-columns'

/**
 * Read the per-dictionary content bundle from the browser's wa-sqlite dict.db
 * (via a DictConnection) into the legacy table arrays the Orama search worker
 * consumes. The client-side twin of the (retired) server
 * `get-dictionary-entries-data.ts`: same tables, JSON columns parsed, soft-
 * deleted rows excluded, sync-bookkeeping columns dropped — so the worker sees
 * the same shape it always has, now sourced from local SQLite instead of an
 * HTTP endpoint.
 */

const DROP_COLUMNS = ['dirty', 'created_by_user_id', 'updated_by_user_id']
const DATA_TABLES = ['entries', 'senses', 'audio', 'speakers', 'tags', 'dialects', 'photos', 'videos', 'sentences'] as const
const JOIN_TABLES = ['audio_speakers', 'entry_tags', 'entry_dialects', 'sense_photos', 'video_speakers', 'sense_videos', 'senses_in_sentences'] as const

export type EntriesDataBundle = Record<string, Record<string, unknown>[]>

interface QueryableConnection {
  query: <T>(sql: string, params?: unknown[]) => Promise<T[]>
}

export async function read_dict_bundle({ connection }: { connection: QueryableConnection }): Promise<EntriesDataBundle> {
  const bundle: EntriesDataBundle = {}
  for (const table of [...DATA_TABLES, ...JOIN_TABLES]) {
    const rows = await connection.query<Record<string, unknown>>(`SELECT * FROM "${table}" WHERE deleted IS NULL`)
    for (const row of rows) {
      parse_dict_row(table, row)
      for (const column of DROP_COLUMNS)
        delete row[column]
    }
    bundle[table] = rows
  }
  return bundle
}
