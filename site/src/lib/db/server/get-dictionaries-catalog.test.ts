import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { open_shared_db } from './shared-db'
import { load_dictionaries_for_user, load_public_dictionaries } from './get-dictionaries-catalog'

let db: Database.Database

beforeEach(() => {
  db = open_shared_db(':memory:')
})

afterEach(() => {
  db.close()
})

function insert_dictionary({ id, public: is_public }: { id: string, public: boolean }) {
  db.prepare(`
    INSERT INTO dictionaries (id, name, public, gloss_languages, alternate_names, coordinates)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    id,
    id,
    is_public ? 1 : 0,
    JSON.stringify(['en', 'es']),
    JSON.stringify(['Other Name']),
    JSON.stringify({ points: [{ coordinates: { longitude: 1, latitude: 2 } }] }),
  )
}

describe(load_dictionaries_for_user, () => {
  test('parses JSON columns (gloss_languages etc.) so the homepage can .map() them', () => {
    insert_dictionary({ id: 'river', public: false })
    db.prepare(`INSERT INTO users (id, email) VALUES (?, ?)`).run('u1', 'eatb4running@gmail.com')
    db.prepare(`INSERT INTO dictionary_roles (id, dictionary_id, user_id, role) VALUES (?, ?, ?, ?)`).run('r1', 'river', 'u1', 'manager')

    const [dictionary] = load_dictionaries_for_user({ db, user_id: 'u1' })

    expect(dictionary.gloss_languages).toEqual(['en', 'es'])
    expect(dictionary.alternate_names).toEqual(['Other Name'])
    expect(dictionary.coordinates).toEqual({ points: [{ coordinates: { longitude: 1, latitude: 2 } }] })
    expect(dictionary.role).toBe('manager')
  })
})

describe(load_public_dictionaries, () => {
  test('parses JSON columns', () => {
    insert_dictionary({ id: 'pub', public: true })
    const [dictionary] = load_public_dictionaries({ db })
    expect(dictionary.gloss_languages).toEqual(['en', 'es'])
  })
})
