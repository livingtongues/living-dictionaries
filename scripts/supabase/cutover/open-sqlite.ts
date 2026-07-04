import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

/**
 * Glob-free SQLite openers for the migration script. The site's own
 * `get_shared_db` / `get_dictionary_db` use Vite's `import.meta.glob` to inline
 * the migration SQL, which only works under Vite — NOT under `tsx`. So here we
 * read the same `*.sql` files directly from disk and run them ourselves.
 *
 * Single source of truth for the schema is still the site's migration folders;
 * we just load them a different way.
 */

const here = dirname(fileURLToPath(import.meta.url))
const SHARED_MIGRATIONS_DIR = join(here, '../../../site/src/lib/db/schemas/shared-migrations')
const DICT_MIGRATIONS_DIR = join(here, '../../../site/src/lib/db/schemas/dictionary-migrations')

function load_migrations(dir: string): { name: string, sql: string }[] {
  return readdirSync(dir)
    .filter(name => name.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b))
    .map(name => ({ name, sql: readFileSync(join(dir, name), 'utf8') }))
}

/** Latest dict migration filename — written into `db_metadata.schema_version`. */
export const LATEST_DICT_MIGRATION = (() => {
  const files = load_migrations(DICT_MIGRATIONS_DIR)
  return files[files.length - 1]?.name || ''
})()

/**
 * Port of the site's `run_sql_migrations`: each migration runs inside a
 * BEGIN/COMMIT with FKs OFF so a partial failure rolls back cleanly.
 */
function run_sql_migrations(db: Database.Database, migrations: { name: string, sql: string }[]) {
  if (migrations.length === 0)
    return

  const has_migrations_table = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'`).get()
  let applied = new Set<string>()
  if (has_migrations_table) {
    const rows = db.prepare('SELECT name FROM migrations').all() as { name: string }[]
    applied = new Set(rows.map(row => row.name))
  }

  for (const { name, sql } of migrations) {
    if (applied.has(name))
      continue
    db.pragma('foreign_keys = OFF')
    try {
      db.exec(`BEGIN; ${sql}; COMMIT;`)
    } catch (error) {
      try { db.exec('ROLLBACK') } catch { /* already rolled back */ }
      db.pragma('foreign_keys = ON')
      throw error
    }
    db.pragma('foreign_keys = ON')

    const table_exists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'`).get()
    if (table_exists) {
      db.prepare('INSERT INTO migrations (id, name, run_on) VALUES (?, ?, ?)')
        .run(crypto.randomUUID(), name, new Date().toISOString())
    }
  }
}

function configure(db: Database.Database) {
  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 5000')
  db.pragma('foreign_keys = ON')
}

/** Open (creating if needed) the shared.db at `${data_dir}/shared.db`. */
export function open_shared_db(data_dir: string): Database.Database {
  mkdirSync(data_dir, { recursive: true })
  const db = new Database(join(data_dir, 'shared.db'))
  configure(db)
  run_sql_migrations(db, load_migrations(SHARED_MIGRATIONS_DIR))
  return db
}

/**
 * Open a per-dict db at `${data_dir}/dictionaries/${dict_id}.db`. With
 * `rebuild: true` (the default for the dress rehearsal) any existing file +
 * its WAL/SHM sidecars are deleted first so we always rebuild from scratch.
 */
export function open_dict_db({ data_dir, dict_id, rebuild = true }: {
  data_dir: string
  dict_id: string
  rebuild?: boolean
}): Database.Database {
  const dir = join(data_dir, 'dictionaries')
  mkdirSync(dir, { recursive: true })
  const db_path = join(dir, `${dict_id}.db`)

  if (rebuild) {
    for (const suffix of ['', '-wal', '-shm']) {
      const path = `${db_path}${suffix}`
      if (existsSync(path))
        rmSync(path)
    }
  }

  const db = new Database(db_path)
  configure(db)
  run_sql_migrations(db, load_migrations(DICT_MIGRATIONS_DIR))

  db.prepare(`INSERT OR IGNORE INTO db_metadata (key, value) VALUES (?, ?)`).run('dictionary_id', dict_id)
  db.prepare(`INSERT OR REPLACE INTO db_metadata (key, value) VALUES (?, ?)`).run('schema_version', LATEST_DICT_MIGRATION)
  return db
}
