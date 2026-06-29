import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { open_dictionary_db_in_memory } from './dictionary-db'
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
