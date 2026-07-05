import { parse_dict_row } from '$lib/db/schemas/dictionary-json-columns'

/**
 * Read the per-dictionary content bundle from the browser's wa-sqlite dict.db
 * (via a DictConnection) into the legacy table arrays the Orama search worker
 * consumes. The client-side twin of the (retired) server
 * `get-dictionary-entries-data.ts`: same tables, JSON columns parsed,
 * sync-bookkeeping columns dropped — so the worker sees the same shape it always
 * has, now sourced from local SQLite instead of an HTTP endpoint. Deletes are
 * hard, so there's no `deleted` column to filter — purged rows are simply absent.
 */

/** Sync-bookkeeping columns dropped from every bundle row so the read-model
 * matches across the client bundle path and the server SSR assembler. */
export const BUNDLE_DROP_COLUMNS = ['dirty', 'created_by_user_id', 'updated_by_user_id'] as const
const DROP_COLUMNS = BUNDLE_DROP_COLUMNS
const DATA_TABLES = ['entries', 'senses', 'audio', 'speakers', 'tags', 'dialects', 'sources', 'photos', 'videos', 'sentences', 'texts'] as const
const JOIN_TABLES = ['audio_speakers', 'entry_tags', 'entry_dialects', 'sense_photos', 'video_speakers', 'sense_videos', 'senses_in_sentences', 'sentence_photos', 'sentence_videos'] as const

/** The per-dict content tables the Orama worker assembles entry/sentence/text docs from — the watcher scans these for deltas. */
export const WATCHED_TABLES = [...DATA_TABLES, ...JOIN_TABLES] as const

export type EntriesDataBundle = Record<string, Record<string, unknown>[]>

interface QueryableConnection {
  query: <T>(sql: string, params?: unknown[]) => Promise<T[]>
}

export async function read_dict_bundle({ connection }: { connection: QueryableConnection }): Promise<EntriesDataBundle> {
  const bundle: EntriesDataBundle = {}
  for (const table of [...DATA_TABLES, ...JOIN_TABLES]) {
    const rows = await connection.query<Record<string, unknown>>(`SELECT * FROM "${table}"`)
    for (const row of rows) {
      parse_dict_row(table, row)
      for (const column of DROP_COLUMNS)
        delete row[column]
    }
    bundle[table] = rows
  }
  return bundle
}
