import type { Table } from 'drizzle-orm'
import { getTableColumns } from 'drizzle-orm'
import * as shared_schema from './shared'

export type TableName = keyof typeof shared_schema

/**
 * Derive the list of JSON-mode columns for a Drizzle table by inspecting
 * `columnType === 'SQLiteTextJson'`. This is an internal Drizzle API detail —
 * if Drizzle ever renames it, the test at the bottom of this file will fail
 * loudly. Fall back to a hand-audited allowlist if needed.
 */
function json_cols_for(table: Table): string[] {
  return Object.entries(getTableColumns(table))
    .filter(([, column]) => (column as { columnType: string }).columnType === 'SQLiteTextJson')
    .map(([name]) => name)
}

/**
 * Map of table name → list of JSON-mode column names. The auto-parse driver
 * uses this to `JSON.parse` on read and `JSON.stringify` on write.
 */
export const JSON_COLUMNS: Readonly<Record<string, readonly string[]>> = Object.freeze(
  Object.fromEntries(
    Object.entries(shared_schema)
      .filter(([, table]) => is_drizzle_table(table))
      .map(([name, table]) => [name, json_cols_for(table as Table)] as const),
  ),
)

function is_drizzle_table(value: unknown): value is Table {
  return typeof value === 'object' && value !== null && typeof (value as Record<symbol, unknown>)[Symbol.for('drizzle:Name')] === 'string'
}

/**
 * Parse JSON-mode columns on a raw row in place and return it typed. Call
 * once per row returned from the connection's `query`.
 */
export function parse_row(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const columns = JSON_COLUMNS[table] || []
  for (const column of columns) {
    const value = row[column]
    if (typeof value === 'string' && value !== '') {
      try {
        row[column] = JSON.parse(value)
      } catch {
        // not parseable — leave as-is (columns are JSON by contract)
      }
    }
  }
  return row
}

/**
 * Stringify JSON-mode columns on an insert/update row in place and return it.
 * Null/undefined pass through untouched; everything else (including plain
 * strings) runs through `JSON.stringify`.
 */
export function stringify_row(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const columns = JSON_COLUMNS[table] || []
  for (const column of columns) {
    const value = row[column]
    if (value !== null && value !== undefined)
      row[column] = JSON.stringify(value)
  }
  return row
}

if (import.meta.vitest) {
  test('JSON_COLUMNS covers every table in shared_schema', () => {
    const expected = [
      'migrations', 'db_metadata', 'deletes',
      'users', 'email_codes', 'email_aliases',
      'dictionaries', 'dictionary_roles', 'invites',
      'client_logs',
    ]
    for (const name of expected)
      expect(JSON_COLUMNS, `JSON_COLUMNS[${name}] must exist`).toHaveProperty(name)
  })

  test('JSON_COLUMNS pins the current JSON-mode column list', () => {
    expect(JSON_COLUMNS.users).toEqual(['providers'])
    expect(JSON_COLUMNS.email_codes).toEqual([])
    expect(JSON_COLUMNS.email_aliases).toEqual([])
    expect(JSON_COLUMNS.dictionaries).toEqual(['alternate_names', 'gloss_languages', 'coordinates', 'metadata', 'orthographies', 'featured_image'])
    expect(JSON_COLUMNS.dictionary_roles).toEqual([])
    expect(JSON_COLUMNS.invites).toEqual([])
    expect(JSON_COLUMNS.client_logs).toEqual([])
    expect(JSON_COLUMNS.deletes).toEqual([])
    expect(JSON_COLUMNS.db_metadata).toEqual([])
    expect(JSON_COLUMNS.migrations).toEqual([])
  })

  test('parse_row parses JSON columns in place', () => {
    const row = {
      id: 'u1',
      providers: '[{"provider":"email","provider_id":"alice@example.com"}]',
      email: 'alice@example.com',
    }
    parse_row('users', row)
    expect(row.providers).toEqual([{ provider: 'email', provider_id: 'alice@example.com' }])
    expect(row.email).toBe('alice@example.com')
  })

  test('parse_row leaves null/undefined JSON columns alone', () => {
    const row = { id: 'u1', providers: null, email: 'alice@example.com' }
    parse_row('users', row)
    expect(row.providers).toBeNull()
  })

  test('stringify_row stringifies object/array JSON columns in place', () => {
    const row = {
      id: 'u1',
      providers: [{ provider: 'email', provider_id: 'alice@example.com' }],
      email: 'alice@example.com',
    }
    stringify_row('users', row)
    expect(row.providers).toBe('[{"provider":"email","provider_id":"alice@example.com"}]')
    expect(row.email).toBe('alice@example.com')
  })

  test('round-trip: stringify → parse recovers the original object', () => {
    const original = {
      id: 'u1',
      providers: [{ provider: 'email', provider_id: 'alice@example.com' }],
      email: 'alice@example.com',
    }
    const round_trip = { ...original, providers: JSON.parse(JSON.stringify(original.providers)) }
    stringify_row('users', round_trip)
    expect(round_trip.providers).toBe('[{"provider":"email","provider_id":"alice@example.com"}]')
    parse_row('users', round_trip)
    expect(round_trip.providers).toEqual(original.providers)
  })

  test('parse_row + stringify_row tolerate unknown table names', () => {
    const row = { foo: 'bar' }
    parse_row('not_a_table', row)
    expect(row).toEqual({ foo: 'bar' })
    stringify_row('not_a_table', row)
    expect(row).toEqual({ foo: 'bar' })
  })
}
