import Database from 'better-sqlite3'
import type { DictConnection } from './worker-connection'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { parse_dict_row } from '$lib/db/schemas/dictionary-json-columns'
import { DICT_MIGRATION_NAMES, DICT_MIGRATIONS } from './dict-migrations-bundle'
import { save_changed_dict_columns } from './dict-save-row'

let handle: Database.Database
let connection: Pick<DictConnection, 'query' | 'execute'>

function make_connection(db: Database.Database): Pick<DictConnection, 'query' | 'execute'> {
  return {
    query: <T>(sql: string, params: unknown[] = []) => Promise.resolve(db.prepare(sql).all(...params as never[]) as T[]),
    execute: (sql: string, params: unknown[] = []) => { db.prepare(sql).run(...params as never[]); return Promise.resolve() },
  }
}

const T0 = '2026-06-01T00:00:00.000Z'
const LEXEME = JSON.stringify({ en: 'hello' })

function insert_entry(over: Record<string, unknown> = {}) {
  const row: Record<string, unknown> = {
    id: 'e1', lexeme: LEXEME, phonetic: 'həˈloʊ', dirty: 0,
    created_by_user_id: 'u1', created_at: T0, updated_by_user_id: 'u1', updated_at: T0, ...over,
  }
  const cols = Object.keys(row)
  handle.prepare(`INSERT INTO entries (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
    .run(...cols.map(c => row[c]) as never[])
}

/** In-memory reactive-row shape: SELECT * with JSON columns parsed. */
async function load(id = 'e1'): Promise<Record<string, unknown>> {
  const [row] = await connection.query<Record<string, unknown>>('SELECT * FROM entries WHERE id = ?', [id])
  return parse_dict_row('entries', row)
}

function read(id = 'e1'): Record<string, unknown> {
  return handle.prepare('SELECT * FROM entries WHERE id = ?').get(id) as Record<string, unknown>
}

beforeEach(() => {
  handle = new Database(':memory:')
  for (const name of DICT_MIGRATION_NAMES)
    handle.exec(DICT_MIGRATIONS[name])
  connection = make_connection(handle)
})
afterEach(() => handle.close())

describe(save_changed_dict_columns, () => {
  test('writes ONLY the mutated text column + always re-stamps dirty/updated_at/updated_by_user_id', async () => {
    insert_entry()
    const row = await load()
    row.phonetic = 'changed'

    const result = await save_changed_dict_columns({ connection, table: 'entries', row, is_syncable: true, user_id: 'editor2' })

    expect(result).toEqual({ changed_columns: ['phonetic'], wrote: true })
    const saved = read()
    expect(saved.phonetic).toBe('changed')
    expect(saved.lexeme).toBe(LEXEME) // untouched
    expect(saved.dirty).toBe(1)
    expect(saved.updated_at).not.toBe(T0)
    expect(saved.updated_by_user_id).toBe('editor2') // re-attributed to the current editor
    expect(saved.created_by_user_id).toBe('u1') // provenance immutable
  })

  test('detects a DEEP change inside a JSON column (lexeme) and writes only it', async () => {
    insert_entry()
    const row = await load()
    ;(row.lexeme as { en: string }).en = 'hi'

    const result = await save_changed_dict_columns({ connection, table: 'entries', row, is_syncable: true, user_id: 'editor2' })

    expect(result.changed_columns).toEqual(['lexeme'])
    const saved = read()
    expect(JSON.parse(saved.lexeme as string)).toEqual({ en: 'hi' })
    expect(saved.phonetic).toBe('həˈloʊ') // untouched
    expect(saved.dirty).toBe(1)
  })

  test('no content change STILL re-dirties + re-attributes (dict semantic: flips a cleaned row back)', async () => {
    insert_entry({ dirty: null })
    const row = await load()

    const result = await save_changed_dict_columns({ connection, table: 'entries', row, is_syncable: true, user_id: 'editor2' })

    expect(result).toEqual({ changed_columns: [], wrote: true })
    const saved = read()
    expect(saved.dirty).toBe(1) // re-dirtied despite no content change
    expect(saved.updated_at).not.toBe(T0)
    expect(saved.updated_by_user_id).toBe('editor2')
  })

  test('non-syncable: re-stamps dirty/updated_at but NOT updated_by_user_id', async () => {
    insert_entry()
    const row = await load()
    row.phonetic = 'ns'

    const result = await save_changed_dict_columns({ connection, table: 'entries', row, is_syncable: false, user_id: 'editor2' })

    expect(result.changed_columns).toEqual(['phonetic'])
    const saved = read()
    expect(saved.dirty).toBe(1)
    expect(saved.updated_by_user_id).toBe('u1') // not re-attributed when non-syncable
  })

  test('missing id → writes nothing', async () => {
    insert_entry()
    const row = await load()
    delete row.id
    row.phonetic = 'orphan'

    const result = await save_changed_dict_columns({ connection, table: 'entries', row, is_syncable: true, user_id: 'editor2' })

    expect(result).toEqual({ changed_columns: [], wrote: false })
    expect(read().phonetic).toBe('həˈloʊ')
  })
})
