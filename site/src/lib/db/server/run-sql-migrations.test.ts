import Database from 'better-sqlite3'
import { run_sql_migrations } from './run-sql-migrations'

describe(run_sql_migrations, () => {
  test('commits schema and marker atomically and restores foreign-key mode', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')

    run_sql_migrations({
      db,
      migration_files: {
        './migrations/20260722_initial.sql': `
          CREATE TABLE migrations (id TEXT PRIMARY KEY, name TEXT NOT NULL, run_on TEXT NOT NULL);
          CREATE TABLE examples (id TEXT PRIMARY KEY);
        `,
      },
    })

    expect(db.prepare(`SELECT name FROM migrations`).pluck().all()).toEqual(['20260722_initial.sql'])
    expect(db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='examples'`).pluck().get()).toBe('examples')
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1)
    db.close()
  })

  test('rolls schema back when recording its marker fails', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = OFF')
    db.exec(`
      CREATE TABLE migrations (id TEXT PRIMARY KEY, name TEXT NOT NULL, run_on TEXT NOT NULL);
      CREATE TRIGGER reject_marker BEFORE INSERT ON migrations BEGIN SELECT RAISE(ABORT, 'marker rejected'); END;
    `)

    expect(() => run_sql_migrations({
      db,
      migration_files: { './migrations/20260722_atomic.sql': 'CREATE TABLE should_rollback (id TEXT PRIMARY KEY);' },
    })).toThrow('marker rejected')
    expect(db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='should_rollback'`).get()).toBeUndefined()
    expect(db.pragma('foreign_keys', { simple: true })).toBe(0)
    db.close()
  })
})
