/**
 * Seed the `achi` per-dictionary SQLite db (`.data/dictionaries/achi.db`) with the
 * dev fixtures from `src/lib/mocks/dummy-entries.ts`.
 *
 * M4 background: in M1/M2b these fixtures were served by the in-memory Supabase
 * stub so the editor flow (`e2e/achi-flow.mjs`) had data. M4 moves entry READS to
 * server SQLite, so the same fixtures now live in achi.db. The real corpus
 * (torwali etc.) proves the read layer on migrated data; achi stays the tiny,
 * deterministic editor-regression fixture.
 *
 * Idempotent: clears + re-inserts the fixture tables. Re-run after re-seeding
 * `.data` from the example. Maps the legacy supabase shape → the per-dict schema
 * (rename `*_by` → `*_by_user_id`, drop `dictionary_id`, JSON-stringify JSON
 * columns, synthesize junction PKs).
 *
 *   pnpm -F site seed:achi-fixture
 */
import process from 'node:process'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'
import { DICT_JSON_COLUMNS } from '../src/lib/db/schemas/dictionary-json-columns'
import {
  dummy_audio,
  dummy_audio_speakers,
  dummy_dialects,
  dummy_entries,
  dummy_entry_dialects,
  dummy_entry_tags,
  dummy_senses,
  dummy_speakers,
  dummy_tags,
} from '../src/lib/mocks/dummy-entries'

const data_dir = process.env.DATA_DIR || '.data'
const db_path = join(data_dir, 'dictionaries', 'achi.db')
const db = new Database(db_path)
db.pragma('foreign_keys = OFF')

function table_columns(table: string): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  return new Set(rows.map(row => row.name))
}

function seed(table: string, rows: Record<string, any>[], { junction = false }: { junction?: boolean } = {}) {
  const columns = table_columns(table)
  const json_columns = DICT_JSON_COLUMNS[table] || []
  db.prepare(`DELETE FROM ${table}`).run()

  for (const source of rows) {
    const row: Record<string, any> = { ...source }
    if ('created_by' in row) { row.created_by_user_id = row.created_by; delete row.created_by }
    if ('updated_by' in row) { row.updated_by_user_id = row.updated_by; delete row.updated_by }
    // Junction fixtures only carry created_by; both *_by_user_id are NOT NULL.
    row.created_by_user_id ??= row.updated_by_user_id
    row.updated_by_user_id ??= row.created_by_user_id
    delete row.dictionary_id
    delete row.linguistic_history
    if (junction && !row.id) row.id = randomUUID()
    for (const column of json_columns)
      if (row[column] !== null && row[column] !== undefined) row[column] = JSON.stringify(row[column])

    const pairs = Object.entries(row).filter(([key, value]) => columns.has(key) && value !== undefined)
    const keys = pairs.map(([key]) => key)
    const placeholders = keys.map(() => '?').join(', ')
    db.prepare(`INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`).run(...pairs.map(([, value]) => value))
  }
  console.info(`  seeded ${rows.length} → ${table}`)
}

console.info(`Seeding achi fixtures into ${db_path}`)
seed('entries', dummy_entries)
seed('senses', dummy_senses)
seed('speakers', dummy_speakers)
seed('audio', dummy_audio)
seed('tags', dummy_tags)
seed('dialects', dummy_dialects)
seed('audio_speakers', dummy_audio_speakers, { junction: true })
seed('entry_tags', dummy_entry_tags, { junction: true })
seed('entry_dialects', dummy_entry_dialects, { junction: true })
db.close()
console.info('Done.')
