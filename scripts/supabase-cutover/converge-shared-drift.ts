import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import Database from 'better-sqlite3'
import { open_shared_db } from './open-sqlite'

/**
 * Converge a pulled prod `shared.db` onto the current schema. Prod was
 * provisioned from a PRE-squash migration chain and `CREATE TABLE IF NOT
 * EXISTS` never re-executes, so columns added by later consolidations are
 * missing (found 2026-07-02: dictionaries.about/citation/grammar/
 * write_in_collaborators — same drift class as the earlier missing
 * dictionary_partners table).
 *
 * Strategy: build a fresh shared.db from the initial, diff, then:
 *   - missing COLUMN → `ALTER TABLE … ADD COLUMN` (name + type + non-constraint
 *     default only — safe, additive)
 *   - missing TABLE / INDEX / TRIGGER → replay its CREATE statement verbatim
 *   - anything ELSE (extra objects, type mismatches) → REPORT ONLY, exit 1
 *
 *   tsx supabase-cutover/converge-shared-drift.ts <path-to-shared.db> [--dry]
 */

function main() {
  const target_path = process.argv.slice(2).find(arg => !arg.startsWith('-'))
  const dry = process.argv.includes('--dry')
  if (!target_path) {
    console.error('usage: tsx converge-shared-drift.ts <shared.db path> [--dry]')
    process.exitCode = 1
    return
  }

  const fresh_dir = mkdtempSync(join(tmpdir(), 'ld-fresh-schema-'))
  const fresh = open_shared_db(fresh_dir)
  const target = new Database(target_path)
  const actions: string[] = []
  const problems: string[] = []

  try {
    const fresh_tables = list(fresh, 'table')
    const target_tables = new Set(list(target, 'table'))

    for (const table of fresh_tables) {
      if (!target_tables.has(table)) {
        const create_sql = (fresh.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).get(table) as { sql: string }).sql
        actions.push(create_sql)
        continue
      }
      const fresh_cols = columns(fresh, table)
      const target_cols = new Map(columns(target, table).map(col => [col.name, col]))
      for (const col of fresh_cols) {
        if (!target_cols.has(col.name)) {
          // NOT NULL without default can't be ADDed — fall back to nullable.
          const notnull = col.notnull && col.dflt_value !== null ? ' NOT NULL' : ''
          const dflt = col.dflt_value !== null ? ` DEFAULT ${col.dflt_value}` : ''
          actions.push(`ALTER TABLE ${table} ADD COLUMN "${col.name}" ${col.type}${notnull}${dflt}`)
        }
      }
      for (const name of target_cols.keys()) {
        if (!fresh_cols.some(col => col.name === name))
          problems.push(`${table}: target has EXTRA column ${name} (left alone)`)
      }
    }

    for (const kind of ['index', 'trigger'] as const) {
      const target_names = new Set(list(target, kind))
      for (const name of list(fresh, kind)) {
        if (!target_names.has(name)) {
          const create_sql = (fresh.prepare(`SELECT sql FROM sqlite_master WHERE type=? AND name=?`).get(kind, name) as { sql: string } | undefined)?.sql
          if (create_sql)
            actions.push(create_sql)
        }
      }
    }

    if (actions.length === 0 && problems.length === 0) {
      console.info('✓ no drift — schema already converged')
      return
    }
    for (const action of actions)
      console.info(`${dry ? '[dry] ' : ''}${action.split('\n')[0]}${action.includes('\n') ? ' …' : ''}`)
    for (const problem of problems)
      console.warn(`⚠ ${problem}`)

    if (!dry) {
      target.pragma('foreign_keys = OFF')
      for (const action of actions)
        target.exec(action)
      target.pragma('foreign_keys = ON')
      console.info(`✓ applied ${actions.length} statements`)
    }
  } finally {
    fresh.close()
    target.close()
    rmSync(fresh_dir, { recursive: true, force: true })
  }
}

function list(db: Database.Database, type: 'table' | 'index' | 'trigger'): string[] {
  return (db.prepare(`SELECT name FROM sqlite_master WHERE type=? AND name NOT LIKE 'sqlite_%' ORDER BY name`).all(type) as { name: string }[]).map(row => row.name)
}

interface ColumnInfo {
  name: string
  type: string
  notnull: number
  dflt_value: string | null
}

function columns(db: Database.Database, table: string): ColumnInfo[] {
  return db.prepare(`SELECT name, type, "notnull", dflt_value FROM pragma_table_info(?)`).all(table) as ColumnInfo[]
}

main()
