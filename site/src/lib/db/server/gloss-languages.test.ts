import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { open_dictionary_db_in_memory } from './dictionary-db'
import { open_test_shared_db } from './shared-db'
import { add_gloss_language, remove_gloss_language } from './gloss-languages'

let shared_db: Database.Database
let dict_db: Database.Database

vi.mock('./shared-db', async () => {
  const actual = await vi.importActual<typeof import('./shared-db')>('./shared-db')
  return { ...actual, get_shared_db: () => shared_db }
})
vi.mock('./dictionary-db', async () => {
  const actual = await vi.importActual<typeof import('./dictionary-db')>('./dictionary-db')
  return { ...actual, get_dictionary_db: () => dict_db }
})

beforeEach(() => {
  shared_db = open_test_shared_db()
  dict_db = open_dictionary_db_in_memory('d1')
  shared_db.prepare(`INSERT INTO users (id, email) VALUES ('u1', 'u1@example.com')`).run()
  shared_db.prepare(`INSERT INTO dictionaries (id, name, gloss_languages) VALUES ('d1', 'Demo', ?)`).run(JSON.stringify(['en']))
})

afterEach(() => {
  shared_db.close()
  dict_db.close()
})

function stored(): string[] {
  const row = shared_db.prepare(`SELECT gloss_languages, dirty FROM dictionaries WHERE id = 'd1'`).get() as { gloss_languages: string, dirty: number }
  expect(row.dirty).toBe(1)
  return JSON.parse(row.gloss_languages) as string[]
}

describe(add_gloss_language, () => {
  test('appends a supported code and marks the catalog row dirty', () => {
    expect(add_gloss_language({ dict_id: 'd1', user_id: 'u1', code: 'fr' })).toEqual(['en', 'fr'])
    expect(stored()).toEqual(['en', 'fr'])
  })

  test('rejects an unsupported code and a duplicate', () => {
    expect(() => add_gloss_language({ dict_id: 'd1', user_id: 'u1', code: 'zz-fake' })).toThrow(/not a supported/)
    expect(() => add_gloss_language({ dict_id: 'd1', user_id: 'u1', code: 'en' })).toThrow(/already/)
  })
})

describe(remove_gloss_language, () => {
  test('removes an unused code', () => {
    add_gloss_language({ dict_id: 'd1', user_id: 'u1', code: 'fr' })
    expect(remove_gloss_language({ dict_id: 'd1', user_id: 'u1', code: 'fr' })).toEqual(['en'])
  })

  test('refuses while a sense stores a gloss under the code', () => {
    dict_db.prepare(`INSERT INTO entries (id, lexeme, created_by_user_id, created_at, updated_by_user_id, updated_at) VALUES ('e1', '{"default":"word"}', 'u1', '2026-01-01', 'u1', '2026-01-01')`).run()
    dict_db.prepare(`INSERT INTO senses (id, entry_id, glosses, created_by_user_id, created_at, updated_by_user_id, updated_at) VALUES ('s1', 'e1', '{"en":"dog"}', 'u1', '2026-01-01', 'u1', '2026-01-01')`).run()
    expect(() => remove_gloss_language({ dict_id: 'd1', user_id: 'u1', code: 'en' })).toThrow(/in use/)
  })

  test('refuses an unknown code', () => {
    expect(() => remove_gloss_language({ dict_id: 'd1', user_id: 'u1', code: 'fr' })).toThrow(/not found/)
  })
})
