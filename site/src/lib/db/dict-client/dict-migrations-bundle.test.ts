import { describe, expect, test } from 'vitest'
import { DICT_MIGRATION_NAMES, DICT_MIGRATIONS, LATEST_DICT_MIGRATION } from './dict-migrations-bundle'

describe('DICT_MIGRATIONS', () => {
  test('includes the initial migration', () => {
    // eslint-disable-next-line no-restricted-syntax
    expect(DICT_MIGRATION_NAMES.length).toBeGreaterThanOrEqual(1)
    expect(DICT_MIGRATION_NAMES[0]).toMatch(/^\d{8}_/)
  })

  test('migration names are lexicographically sorted', () => {
    const sorted = [...DICT_MIGRATION_NAMES].sort()
    expect(DICT_MIGRATION_NAMES).toEqual(sorted)
  })

  test('every name has matching SQL contents in the map', () => {
    for (const name of DICT_MIGRATION_NAMES) {
      expect(DICT_MIGRATIONS[name]).toBeTypeOf('string')
      // eslint-disable-next-line no-restricted-syntax
      expect(DICT_MIGRATIONS[name].length).toBeGreaterThan(0)
    }
  })

  test('LATEST_DICT_MIGRATION matches the last sorted name', () => {
    expect(LATEST_DICT_MIGRATION).toBe(DICT_MIGRATION_NAMES[DICT_MIGRATION_NAMES.length - 1])
  })

  test('initial migration creates the migrations + db_metadata + deletes tables', () => {
    const initial = DICT_MIGRATIONS[DICT_MIGRATION_NAMES[0]]
    expect(initial).toContain('CREATE TABLE IF NOT EXISTS migrations')
    expect(initial).toContain('CREATE TABLE IF NOT EXISTS db_metadata')
    expect(initial).toContain('CREATE TABLE IF NOT EXISTS deletes')
    expect(initial).toContain('CREATE TABLE IF NOT EXISTS entries')
    expect(initial).toContain('process_delete_cascade')
  })
})
