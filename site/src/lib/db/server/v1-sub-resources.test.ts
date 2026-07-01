import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { open_dictionary_db_in_memory } from './dictionary-db'
import { open_dictionary_history_db_in_memory } from './dictionary-history-db'
import { create_speaker, find_or_create_dialect, find_or_create_tag, list_dialects, list_speakers, list_tags } from './v1-sub-resources'

let db: Database.Database

beforeEach(() => {
  db = open_dictionary_db_in_memory('dict-1')
})

afterEach(() => db.close())

describe(create_speaker, () => {
  test('creates and lists a speaker', () => {
    const { speaker } = create_speaker({ db, user_id: 'u1', input: { name: 'Ada', decade: 5, gender: 'f', birthplace: 'Lagos' } })
    expect(speaker.name).toBe('Ada')
    const listed = list_speakers(db)
    expect(listed).toHaveLength(1)
    expect(listed[0]).toMatchObject({ name: 'Ada', decade: 5, gender: 'f', birthplace: 'Lagos' })
    const row = db.prepare(`SELECT created_by_user_id FROM speakers WHERE id = ?`).get(speaker.id) as { created_by_user_id: string }
    expect(row.created_by_user_id).toBe('u1')
  })

  test('rejects a blank name', () => {
    expect(() => create_speaker({ db, user_id: 'u1', input: { name: '  ' } })).toThrow(/name is required/)
  })
})

describe(find_or_create_tag, () => {
  test('creates then dedupes case-insensitively', () => {
    const first = find_or_create_tag({ db, user_id: 'u1', name: 'Flora' })
    expect(first.created).toBeTruthy()
    const second = find_or_create_tag({ db, user_id: 'u1', name: 'flora' })
    expect(second.created).toBeFalsy()
    expect(second.tag.id).toBe(first.tag.id)
    expect(list_tags(db)).toHaveLength(1)
  })

  test('honors the private flag', () => {
    const { tag } = find_or_create_tag({ db, user_id: 'u1', name: 'internal', is_private: true })
    expect(tag.private).toBe(1)
  })
})

describe(find_or_create_dialect, () => {
  test('creates then dedupes case-insensitively', () => {
    const first = find_or_create_dialect({ db, user_id: 'u1', name: 'Coastal' })
    expect(first.created).toBeTruthy()
    expect(first.dialect.name).toEqual({ default: 'Coastal' })
    const second = find_or_create_dialect({ db, user_id: 'u1', name: 'coastal' })
    expect(second.created).toBeFalsy()
    expect(list_dialects(db)).toHaveLength(1)
  })
})

describe('api_key_id attribution', () => {
  let history_db: Database.Database

  beforeEach(() => {
    history_db = open_dictionary_history_db_in_memory()
  })

  afterEach(() => history_db.close())

  function api_key_id_for(table: string): string | null {
    const row = history_db.prepare(`SELECT api_key_id FROM changes WHERE table_name = ? ORDER BY at DESC LIMIT 1`).get(table) as { api_key_id: string | null } | undefined
    return row?.api_key_id ?? null
  }

  test('create_speaker records the api_key_id on the history change', () => {
    create_speaker({ db, history_db, user_id: 'u1', api_key_id: 'key-1', input: { name: 'Ada' } })
    expect(api_key_id_for('speakers')).toBe('key-1')
  })

  test('find_or_create_tag records the api_key_id on the history change', () => {
    find_or_create_tag({ db, history_db, user_id: 'u1', api_key_id: 'key-2', name: 'Flora' })
    expect(api_key_id_for('tags')).toBe('key-2')
  })

  test('find_or_create_dialect records the api_key_id on the history change', () => {
    find_or_create_dialect({ db, history_db, user_id: 'u1', api_key_id: 'key-3', name: 'Coastal' })
    expect(api_key_id_for('dialects')).toBe('key-3')
  })

  test('session writes (no api_key_id) leave the column null', () => {
    find_or_create_tag({ db, history_db, user_id: 'u1', name: 'SessionTag' })
    expect(api_key_id_for('tags')).toBeNull()
  })
})
