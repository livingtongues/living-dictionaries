// One-off: rebuild every per-dict SQLite DB onto the new hard-delete schema
// (20260606_initial) by COPYING data out of the set-aside old soft-delete DBs —
// no Supabase re-pull. Only the trigger + `deleted` column changed, so the real
// rows are identical; we drop the `deleted` column and purge soft-deleted rows.
//
// Run from the `site/` dir:  node scripts/migrate-dict-dbs-hard-delete.mjs
//
// Reads:  .data/dictionaries.old-soft-delete-schema/*.db   (set aside by hand)
// Writes: .data/dictionaries/*.db                          (fresh, new schema)

import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3'

const OLD_DIR = '.data/dictionaries.old-soft-delete-schema'
const NEW_DIR = '.data/dictionaries'
const MIGRATION_NAME = '20260606_initial'
const MIGRATION_SQL = readFileSync(`src/lib/db/schemas/dictionary-migrations/${MIGRATION_NAME}.sql`, 'utf8')

const SYNCABLE_TABLES = [
  'entries', 'texts', 'sentences', 'senses', 'senses_in_sentences', 'speakers',
  'audio', 'audio_speakers', 'videos', 'video_speakers', 'sense_videos', 'sentence_videos',
  'photos', 'sense_photos', 'sentence_photos', 'dialects', 'entry_dialects', 'tags', 'entry_tags',
]

if (!existsSync(OLD_DIR)) {
  console.error(`No old dir at ${OLD_DIR} — nothing to copy.`)
  process.exit(1)
}
if (!existsSync(NEW_DIR)) mkdirSync(NEW_DIR, { recursive: true })

const files = readdirSync(OLD_DIR).filter(f => f.endsWith('.db'))
let ok = 0
let rows_total = 0
let dropped_total = 0
let failed = 0

for (const file of files) {
  const old_path = join(OLD_DIR, file)
  const new_path = join(NEW_DIR, file)
  let old
  let fresh
  try {
    old = new Database(old_path, { readonly: true })
    // Build the fresh DB from scratch.
    for (const ext of ['', '-wal', '-shm']) if (existsSync(new_path + ext)) rmSync(new_path + ext, { force: true })
    fresh = new Database(new_path)
    fresh.pragma('journal_mode = WAL')
    fresh.pragma('foreign_keys = OFF') // copy in any order; FKs are consistent in the source
    fresh.exec(MIGRATION_SQL)
    fresh.prepare(`INSERT OR IGNORE INTO migrations (id, name, run_on) VALUES (?, ?, ?)`)
      .run(randomUUID(), MIGRATION_NAME, new Date().toISOString())

    const old_tables = new Set(
      old.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all().map(r => r.name),
    )

    for (const table of SYNCABLE_TABLES) {
      if (!old_tables.has(table)) continue
      const new_cols = fresh.prepare(`PRAGMA table_info("${table}")`).all().map(c => c.name)
      const old_cols = new Set(old.prepare(`PRAGMA table_info("${table}")`).all().map(c => c.name))
      const cols = new_cols.filter(c => old_cols.has(c)) // intersection (excludes the dropped `deleted`)
      const had_deleted = old_cols.has('deleted')
      const where = had_deleted ? 'WHERE deleted IS NULL' : ''
      const total = old.prepare(`SELECT COUNT(*) AS c FROM "${table}"`).get().c
      const rows = old.prepare(
        `SELECT ${cols.map(c => `"${c}"`).join(', ')} FROM "${table}" ${where}`,
      ).all()
      dropped_total += total - rows.length
      if (!rows.length) continue
      const insert = fresh.prepare(
        `INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      )
      const tx = fresh.transaction(() => { for (const r of rows) insert.run(...cols.map(c => r[c])) })
      tx()
      rows_total += rows.length
    }

    // Carry db_metadata LAST so the original `last_modified_at` cursor overrides
    // the values the bump triggers wrote during the copy. Force schema_version.
    if (old_tables.has('db_metadata')) {
      for (const { key, value } of old.prepare(`SELECT key, value FROM db_metadata`).all()) {
        if (key === 'schema_version') continue
        fresh.prepare(`INSERT INTO db_metadata (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(key, value)
      }
    }
    fresh.prepare(`INSERT INTO db_metadata (key, value) VALUES ('schema_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(MIGRATION_NAME)

    ok++
  } catch (err) {
    failed++
    console.error(`✗ ${file}: ${err.message}`)
  } finally {
    old?.close()
    fresh?.close()
  }
}

console.info(`\nDone: ${ok}/${files.length} dict DBs rebuilt (${failed} failed). Copied ${rows_total} rows; dropped ${dropped_total} soft-deleted.`)
