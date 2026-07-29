import Database from 'better-sqlite3'
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

  test('repairs folder-shaped legacy audio paths without dirtying the row', () => {
    const db = new Database(':memory:')
    const repair_name = '20260728_repair_legacy_audio_paths.sql'
    for (const name of DICT_MIGRATION_NAMES) {
      if (name === repair_name)
        break
      db.exec(DICT_MIGRATIONS[name])
    }
    db.prepare(`
      INSERT INTO entries (
        id, lexeme, dirty, created_by_user_id, updated_by_user_id, created_at, updated_at
      ) VALUES (?, ?, NULL, ?, ?, ?, ?)
    `).run(
      '92d2d861-9ee1-4993-9969-c2823aa3dcfa',
      '{"en":"test"}',
      'user-1',
      'user-1',
      '2025-11-20T00:00:00.000Z',
      '2025-11-20T00:00:00.000Z',
    )
    db.prepare(`
      INSERT INTO audio (
        id, entry_id, storage_path, dirty, created_by_user_id, updated_by_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?)
    `).run(
      'd9e47a00-b670-4171-a83a-4c71322cb5dc',
      '92d2d861-9ee1-4993-9969-c2823aa3dcfa',
      'norsii/audio/92d2d861-9ee1-4993-9969-c2823aa3dcfa/1763654313463.wav',
      'user-1',
      'user-1',
      '2025-11-20T00:00:00.000Z',
      '2025-11-20T00:00:00.000Z',
    )

    db.exec(DICT_MIGRATIONS[repair_name])

    expect(db.prepare('SELECT storage_path, dirty FROM audio').get()).toEqual({
      storage_path: 'norsii/audio/d9e47a00-b670-4171-a83a-4c71322cb5dc.wav',
      dirty: null,
    })
    db.close()
  })
})
