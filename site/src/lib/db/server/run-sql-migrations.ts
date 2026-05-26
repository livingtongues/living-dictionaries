import type Database from 'better-sqlite3'

/**
 * Runs SQL migrations from a glob import map. Migration files are inlined at
 * build time via `import.meta.glob('./*.sql', { eager: true, query: '?raw',
 * import: 'default' })`. The keys are relative paths like
 * `./migrations/20260525_initial.sql`.
 *
 * Each migration wraps in BEGIN/COMMIT with FKs OFF so a partial failure
 * rolls back cleanly. Critical for table-rebuild migrations
 * (CREATE _new -> INSERT -> DROP parent -> RENAME) which would otherwise
 * cascade-delete child rows during the DROP. See
 * `.knowledge/architecture/sqlite-migration-gotchas.md` for the post-mortem
 * (carried over from house).
 */
export function run_sql_migrations({ db, migration_files }: {
  db: Database.Database
  migration_files: Record<string, string>
}) {
  const sorted_migrations = Object.entries(migration_files)
    .map(([path, sql]) => {
      const name = path.split('/').pop()
      return { name, sql }
    })
    .sort((a, b) => a.name!.localeCompare(b.name!))

  if (sorted_migrations.length === 0)
    return

  const has_migrations_table = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'`).get()

  let applied = new Set<string>()
  if (has_migrations_table) {
    const rows = db.prepare('SELECT name FROM migrations').all() as { name: string }[]
    applied = new Set(rows.map(r => r.name))
  }

  for (const { name, sql } of sorted_migrations) {
    if (!name || applied.has(name))
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
      db.prepare('INSERT INTO migrations (id, name, run_on) VALUES (?, ?, ?)').run(
        crypto.randomUUID(),
        name,
        new Date().toISOString(),
      )
    }
  }
}
