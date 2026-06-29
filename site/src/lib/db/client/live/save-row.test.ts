import Database from 'better-sqlite3'
import type { SqliteConnection } from '../connection'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { parse_row } from '$lib/db/schemas/json-columns'
import { save_changed_columns } from './save-row'

let handle: Database.Database
let connection: SqliteConnection

/** Adapt a synchronous better-sqlite3 handle to the async SqliteConnection shape. */
function make_connection(db: Database.Database): SqliteConnection {
  return {
    query: <T>(sql: string, params: unknown[] = []) => Promise.resolve(db.prepare(sql).all(...params as never[]) as T[]),
    execute: (sql: string, params: unknown[] = []) => { db.prepare(sql).run(...params as never[]); return Promise.resolve() },
    exec_raw: (sql: string) => { db.exec(sql); return Promise.resolve() },
    close: () => Promise.resolve(),
    delete_db: () => Promise.resolve(),
  }
}

const T0 = '2026-06-01T00:00:00.000Z'
const PROVIDERS = JSON.stringify([{ provider: 'email', provider_id: 'a@x.com' }])

function insert_user(over: Record<string, unknown> = {}) {
  const row: Record<string, unknown> = { id: 'u1', name: 'Original', providers: PROVIDERS, dirty: 0, created_at: T0, updated_at: T0, ...over }
  const cols = Object.keys(row)
  handle.prepare(`INSERT INTO users (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...cols.map(c => row[c]) as never[])
}

/** In-memory reactive-row shape: SELECT * with JSON columns parsed. */
async function load(id = 'u1'): Promise<Record<string, unknown>> {
  const [row] = await connection.query<Record<string, unknown>>('SELECT * FROM users WHERE id = ?', [id])
  return parse_row('users', row)
}

function read(id = 'u1'): Record<string, unknown> {
  return handle.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown>
}

beforeEach(() => {
  handle = new Database(':memory:')
  handle.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, providers TEXT, dirty INTEGER, created_at TEXT, updated_at TEXT)`)
  connection = make_connection(handle)
})
afterEach(() => handle.close())

describe(save_changed_columns, () => {
  test('writes ONLY the mutated text column + dirty=1 + bumped updated_at; leaves the rest', async () => {
    insert_user()
    const row = await load()
    row.name = 'New'

    const result = await save_changed_columns({ connection, table_name: 'users', row, primary_keys: ['id'], is_syncable: true })

    expect(result).toEqual({ changed_columns: ['name'], wrote: true })
    const saved = read()
    expect(saved.name).toBe('New')
    expect(saved.providers).toBe(PROVIDERS) // untouched
    expect(saved.dirty).toBe(1)
    expect(saved.updated_at).not.toBe(T0)
    expect(row.dirty).toBe(1) // stamp mirrored onto the in-memory row
  })

  test('detects a DEEP change inside a JSON column and writes only that column', async () => {
    insert_user()
    const row = await load()
    ;(row.providers as { provider_id: string }[])[0].provider_id = 'b@x.com'

    const result = await save_changed_columns({ connection, table_name: 'users', row, primary_keys: ['id'], is_syncable: true })

    expect(result.changed_columns).toEqual(['providers'])
    const saved = read()
    expect(JSON.parse(saved.providers as string)).toEqual([{ provider: 'email', provider_id: 'b@x.com' }])
    expect(saved.name).toBe('Original') // untouched
    expect(saved.dirty).toBe(1)
  })

  test('no-op when nothing changed: no write, dirty stays 0, updated_at unchanged (JSON round-trips clean)', async () => {
    insert_user()
    const row = await load()

    const result = await save_changed_columns({ connection, table_name: 'users', row, primary_keys: ['id'], is_syncable: true })

    expect(result).toEqual({ changed_columns: [], wrote: false })
    const saved = read()
    expect(saved.dirty).toBe(0)
    expect(saved.updated_at).toBe(T0)
  })

  test('non-syncable: writes the changed column but does NOT set dirty or bump updated_at', async () => {
    insert_user()
    const row = await load()
    row.name = 'NS'

    const result = await save_changed_columns({ connection, table_name: 'users', row, primary_keys: ['id'], is_syncable: false })

    expect(result).toEqual({ changed_columns: ['name'], wrote: true })
    const saved = read()
    expect(saved.dirty).toBe(0)
    expect(saved.updated_at).toBe(T0)
  })

  test('composite primary keys build an AND-ed WHERE that targets only the matching row', async () => {
    insert_user({ id: 'a', name: 'shared' })
    insert_user({ id: 'b', name: 'shared', providers: JSON.stringify([{ provider: 'google', provider_id: 'g' }]) })
    const row = await load('a')
    ;(row.providers as { provider_id: string }[])[0].provider_id = 'changed'

    await save_changed_columns({ connection, table_name: 'users', row, primary_keys: ['id', 'name'], is_syncable: true })

    expect(JSON.parse(read('a').providers as string)[0].provider_id).toBe('changed')
    expect(JSON.parse(read('b').providers as string)[0].provider_id).toBe('g') // untouched
  })

  test('missing primary key → warns and writes nothing', async () => {
    insert_user()
    const row = await load()
    delete row.id
    row.name = 'orphan'

    const result = await save_changed_columns({ connection, table_name: 'users', row, primary_keys: ['id'], is_syncable: true })

    expect(result).toEqual({ changed_columns: [], wrote: false })
    expect(read().name).toBe('Original')
  })
})
