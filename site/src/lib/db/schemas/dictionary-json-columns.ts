import type { Table } from 'drizzle-orm'
import { getTableColumns } from 'drizzle-orm'
import * as dict_schema from './dictionary'

export type DictTableName = keyof typeof dict_schema

function json_cols_for(table: Table): string[] {
  return Object.entries(getTableColumns(table))
    .filter(([, column]) => (column as { columnType: string }).columnType === 'SQLiteTextJson')
    .map(([name]) => name)
}

/**
 * Map of dict.db table name → list of JSON-mode column names. Used by the
 * dict push/pull endpoint + client-side wrappers (parallel to the shared.db
 * `JSON_COLUMNS` in ./json-columns.ts).
 */
export const DICT_JSON_COLUMNS: Readonly<Record<string, readonly string[]>> = Object.freeze(
  Object.fromEntries(
    Object.entries(dict_schema)
      .filter(([, table]) => is_drizzle_table(table))
      .map(([name, table]) => [name, json_cols_for(table as Table)] as const),
  ),
)

function is_drizzle_table(value: unknown): value is Table {
  return typeof value === 'object' && value !== null && typeof (value as Record<symbol, unknown>)[Symbol.for('drizzle:Name')] === 'string'
}

export function parse_dict_row(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const columns = DICT_JSON_COLUMNS[table] || []
  for (const column of columns) {
    const value = row[column]
    if (typeof value === 'string' && value !== '') {
      try {
        row[column] = JSON.parse(value)
      } catch {
        // not parseable — leave as-is
      }
    }
  }
  return row
}

export function stringify_dict_row(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const columns = DICT_JSON_COLUMNS[table] || []
  for (const column of columns) {
    const value = row[column]
    if (value !== null && value !== undefined)
      row[column] = JSON.stringify(value)
  }
  return row
}

if (import.meta.vitest) {
  test('DICT_JSON_COLUMNS covers core dict tables', () => {
    expect(DICT_JSON_COLUMNS.entries).toEqual(['lexeme', 'notes', 'sources', 'scientific_names', 'coordinates', 'unsupported_fields'])
    expect(DICT_JSON_COLUMNS.senses).toEqual(['definition', 'glosses', 'parts_of_speech', 'semantic_domains', 'write_in_semantic_domains', 'plural_form', 'variant'])
    expect(DICT_JSON_COLUMNS.sentences).toEqual(['text', 'translation'])
    expect(DICT_JSON_COLUMNS.dialects).toEqual(['name'])
    expect(DICT_JSON_COLUMNS.videos).toEqual(['hosted_elsewhere'])
    expect(DICT_JSON_COLUMNS.audio).toEqual([])
    expect(DICT_JSON_COLUMNS.photos).toEqual([])
    expect(DICT_JSON_COLUMNS.tags).toEqual([])
    expect(DICT_JSON_COLUMNS.entry_tags).toEqual([])
  })

  test('parse_dict_row + stringify_dict_row round trip', () => {
    const original = { id: 'e1', lexeme: { en: 'hello', ru: 'привет' } }
    const row = { ...original, lexeme: JSON.parse(JSON.stringify(original.lexeme)) }
    stringify_dict_row('entries', row)
    expect(row.lexeme).toBe('{"en":"hello","ru":"привет"}')
    parse_dict_row('entries', row)
    expect(row.lexeme).toEqual(original.lexeme)
  })
}
