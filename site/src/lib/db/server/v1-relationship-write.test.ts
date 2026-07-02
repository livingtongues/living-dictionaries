import type Database from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { open_dictionary_db_in_memory } from './dictionary-db'
import { open_dictionary_history_db_in_memory } from './dictionary-history-db'
import {
  apply_relationship_create,
  apply_relationship_delete,
  find_or_create_relationship_type,
  list_relationship_types,
  list_relationships_for_entry,
} from './v1-relationship-write'

let db: Database.Database

function insert_entry(id: string, lexeme: Record<string, string>) {
  const now = new Date().toISOString()
  db.prepare(`INSERT INTO entries (id, lexeme, created_by_user_id, created_at, updated_by_user_id, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(id, JSON.stringify(lexeme), 'u1', now, 'u1', now)
}

function insert_sense(id: string, entry_id: string) {
  const now = new Date().toISOString()
  db.prepare(`INSERT INTO senses (id, entry_id, created_by_user_id, created_at, updated_by_user_id, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(id, entry_id, 'u1', now, 'u1', now)
}

function insert_source(slug: string) {
  const now = new Date().toISOString()
  db.prepare(`INSERT INTO sources (id, slug, created_by_user_id, created_at, updated_by_user_id, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(crypto.randomUUID(), slug, 'u1', now, 'u1', now)
}

function tombstone(table_name: string, id: string) {
  db.prepare(`INSERT INTO deletes (table_name, id, updated_at) VALUES (?, ?, ?)`).run(table_name, id, new Date().toISOString())
}

function relationship_count(): number {
  return (db.prepare(`SELECT COUNT(*) AS c FROM entry_relationships`).get() as { c: number }).c
}

beforeEach(() => {
  db = open_dictionary_db_in_memory('dict-1')
  insert_entry('dog', { default: 'dog' })
  insert_entry('perro', { default: 'perro' })
  insert_entry('cat', { default: 'cat' })
})

afterEach(() => db.close())

describe(apply_relationship_create, () => {
  test('creates a global (symmetric) relationship and reads it from both sides', () => {
    const { relationship, created } = apply_relationship_create({ db, input: { from_entry_id: 'dog', to_entry_id: 'perro', type: 'cognate' }, user_id: 'u1' })
    expect(created).toBeTruthy()
    expect(relationship.type).toBe('cognate')
    expect(relationship.symmetric).toBeTruthy()
    expect(relationship.direction).toBe('forward')
    expect(relationship.label_key).toBe('relationship_type.cognate')
    expect(relationship.related.entry_id).toBe('perro')
    expect(relationship.related.lexeme).toEqual({ default: 'perro' })

    const row = db.prepare(`SELECT created_by_user_id, dirty FROM entry_relationships WHERE id = ?`).get(relationship.id) as { created_by_user_id: string, dirty: number | null }
    expect(row.created_by_user_id).toBe('u1')

    // From perro's viewpoint: same row, inverse direction, symmetric label unchanged.
    const from_perro = list_relationships_for_entry(db, 'perro')
    expect(from_perro).toHaveLength(1)
    expect(from_perro[0].direction).toBe('inverse')
    expect(from_perro[0].label_key).toBe('relationship_type.cognate')
    expect(from_perro[0].related.entry_id).toBe('dog')
  })

  test('is idempotent — an identical relationship returns the existing row', () => {
    const first = apply_relationship_create({ db, input: { from_entry_id: 'dog', to_entry_id: 'perro', type: 'synonym' }, user_id: 'u1' })
    const second = apply_relationship_create({ db, input: { from_entry_id: 'dog', to_entry_id: 'perro', type: 'synonym' }, user_id: 'u1' })
    expect(second.created).toBeFalsy()
    expect(second.relationship.id).toBe(first.relationship.id)
    expect(relationship_count()).toBe(1)
  })

  test('symmetric types dedupe the reverse direction (A→B == B→A)', () => {
    const forward = apply_relationship_create({ db, input: { from_entry_id: 'dog', to_entry_id: 'perro', type: 'synonym' }, user_id: 'u1' })
    const reverse = apply_relationship_create({ db, input: { from_entry_id: 'perro', to_entry_id: 'dog', type: 'synonym' }, user_id: 'u1' })
    expect(reverse.created).toBeFalsy()
    expect(reverse.relationship.id).toBe(forward.relationship.id)
    expect(relationship_count()).toBe(1)
  })

  test('directed global: canonical member stores as-is and flips its label by side', () => {
    insert_entry('animal', { default: 'animal' })
    // animal is the broader term (hypernym) of dog.
    const { relationship } = apply_relationship_create({ db, input: { from_entry_id: 'animal', to_entry_id: 'dog', type: 'hypernym' }, user_id: 'u1' })
    expect(relationship.type).toBe('hypernym')
    expect(relationship.symmetric).toBeFalsy()
    expect(relationship.label_key).toBe('relationship_type.hypernym')

    const stored = db.prepare(`SELECT from_entry_id, to_entry_id, type FROM entry_relationships WHERE id = ?`).get(relationship.id) as { from_entry_id: string, to_entry_id: string, type: string }
    expect(stored).toEqual({ from_entry_id: 'animal', to_entry_id: 'dog', type: 'hypernym' })

    // From dog's viewpoint: inverse side shows the hyponym label.
    const from_dog = list_relationships_for_entry(db, 'dog')
    expect(from_dog[0].direction).toBe('inverse')
    expect(from_dog[0].label_key).toBe('relationship_type.hyponym')
    expect(from_dog[0].related.entry_id).toBe('animal')
  })

  test('directed global: inverse alias is canonicalized (stored slug + flipped endpoints)', () => {
    insert_entry('animal', { default: 'animal' })
    // Author from the specific word: dog is a hyponym (narrower) of animal.
    const { relationship } = apply_relationship_create({ db, input: { from_entry_id: 'dog', to_entry_id: 'animal', type: 'hyponym' }, user_id: 'u1' })
    // Stored canonicalized to hypernym with endpoints flipped (animal → dog).
    const stored = db.prepare(`SELECT from_entry_id, to_entry_id, type FROM entry_relationships WHERE id = ?`).get(relationship.id) as { from_entry_id: string, to_entry_id: string, type: string }
    expect(stored).toEqual({ from_entry_id: 'animal', to_entry_id: 'dog', type: 'hypernym' })

    // The POSTer's viewpoint (dog) still reads naturally as the narrower term.
    expect(relationship.direction).toBe('inverse')
    expect(relationship.label_key).toBe('relationship_type.hyponym')
    expect(relationship.related.entry_id).toBe('animal')
  })

  test('directed global: canonical + reverse-alias dedupe to one row', () => {
    insert_entry('animal', { default: 'animal' })
    const canonical = apply_relationship_create({ db, input: { from_entry_id: 'animal', to_entry_id: 'dog', type: 'hypernym' }, user_id: 'u1' })
    const alias = apply_relationship_create({ db, input: { from_entry_id: 'dog', to_entry_id: 'animal', type: 'hyponym' }, user_id: 'u1' })
    expect(alias.created).toBeFalsy()
    expect(alias.relationship.id).toBe(canonical.relationship.id)
    expect(relationship_count()).toBe(1)
  })

  test('rejects an unknown global type', () => {
    expect(() => apply_relationship_create({ db, input: { from_entry_id: 'dog', to_entry_id: 'perro', type: 'nonsense' }, user_id: 'u1' })).toThrow(/unknown relationship type/)
  })

  test('rejects a self-link at the same granularity', () => {
    expect(() => apply_relationship_create({ db, input: { from_entry_id: 'dog', to_entry_id: 'dog', type: 'synonym' }, user_id: 'u1' })).toThrow(/itself/)
  })

  test('rejects a missing entry', () => {
    expect(() => apply_relationship_create({ db, input: { from_entry_id: 'dog', to_entry_id: 'ghost', type: 'synonym' }, user_id: 'u1' })).toThrow(/not found/)
  })

  test('validates a sense belongs to its entry', () => {
    insert_sense('dog-s1', 'dog')
    insert_sense('cat-s1', 'cat')
    // dog-s1 does belong to dog → OK
    const ok = apply_relationship_create({ db, input: { from_entry_id: 'dog', from_sense_id: 'dog-s1', to_entry_id: 'cat', to_sense_id: 'cat-s1', type: 'antonym' }, user_id: 'u1' })
    expect(ok.created).toBeTruthy()
    expect(ok.relationship.related.sense_id).toBe('cat-s1')
    // cat-s1 does NOT belong to dog → reject
    expect(() => apply_relationship_create({ db, input: { from_entry_id: 'dog', from_sense_id: 'cat-s1', to_entry_id: 'perro', type: 'synonym' }, user_id: 'u1' })).toThrow(/does not belong/)
  })

  test('entry-level and sense-level are distinct rows (not deduped together)', () => {
    insert_sense('dog-s1', 'dog')
    apply_relationship_create({ db, input: { from_entry_id: 'dog', to_entry_id: 'perro', type: 'synonym' }, user_id: 'u1' })
    apply_relationship_create({ db, input: { from_entry_id: 'dog', from_sense_id: 'dog-s1', to_entry_id: 'perro', type: 'synonym' }, user_id: 'u1' })
    expect(relationship_count()).toBe(2)
  })

  test('validates source slugs', () => {
    expect(() => apply_relationship_create({ db, input: { from_entry_id: 'dog', to_entry_id: 'perro', type: 'cognate', sources: ['ghost'] }, user_id: 'u1' })).toThrow(/unknown source slug/)
    insert_source('swadesh')
    const ok = apply_relationship_create({ db, input: { from_entry_id: 'dog', to_entry_id: 'perro', type: 'cognate', sources: ['swadesh'], note: 'shared etymon' }, user_id: 'u1' })
    expect(ok.relationship.sources).toEqual(['swadesh'])
    expect(ok.relationship.note).toEqual({ default: 'shared etymon' })
  })
})

describe(find_or_create_relationship_type, () => {
  test('creates a custom type then dedupes by name', () => {
    const first = apply_relationship_create({ db, input: { from_entry_id: 'dog', to_entry_id: 'perro', custom_type: { name: 'Compare' } }, user_id: 'u1' })
    expect(first.created).toBeTruthy()
    expect(first.relationship.custom).toBeTruthy()
    expect(first.relationship.name).toEqual({ default: 'Compare' })
    // Second use with the same name reuses the type (dedupe by name-key).
    apply_relationship_create({ db, input: { from_entry_id: 'dog', to_entry_id: 'cat', custom_type: { name: 'compare' } }, user_id: 'u1' })
    expect(list_relationship_types(db)).toHaveLength(1)
  })

  test('directed custom type flips its label by side', () => {
    const created = apply_relationship_create({ db, input: { from_entry_id: 'dog', to_entry_id: 'perro', custom_type: { name: 'plural of', inverse_name: 'singular of', symmetric: false } }, user_id: 'u1' })
    expect(created.relationship.symmetric).toBeFalsy()
    expect(created.relationship.name).toEqual({ default: 'plural of' })

    const from_perro = list_relationships_for_entry(db, 'perro')
    expect(from_perro[0].direction).toBe('inverse')
    expect(from_perro[0].name).toEqual({ default: 'singular of' })
  })

  test('a blank custom type name throws', () => {
    expect(() => find_or_create_relationship_type({ db, input: { name: '   ' }, user_id: 'u1' })).toThrow(/name is required/)
  })
})

describe(apply_relationship_delete, () => {
  test('deletes by id', () => {
    const { relationship } = apply_relationship_create({ db, input: { from_entry_id: 'dog', to_entry_id: 'perro', type: 'synonym' }, user_id: 'u1' })
    const result = apply_relationship_delete({ db, id: relationship.id, user_id: 'u1' })
    expect(result.found).toBeTruthy()
    expect(relationship_count()).toBe(0)
  })

  test('returns found:false for an unknown id', () => {
    expect(apply_relationship_delete({ db, id: 'nope', user_id: 'u1' }).found).toBeFalsy()
  })
})

describe('cascade behavior', () => {
  test('deleting an endpoint entry removes the relationship', () => {
    apply_relationship_create({ db, input: { from_entry_id: 'dog', to_entry_id: 'perro', type: 'synonym' }, user_id: 'u1' })
    expect(relationship_count()).toBe(1)
    tombstone('entries', 'perro')
    expect(db.prepare(`SELECT 1 FROM entries WHERE id = ?`).get('perro')).toBeUndefined()
    expect(relationship_count()).toBe(0)
  })

  test('deleting a custom type removes relationships using it', () => {
    const { relationship } = apply_relationship_create({ db, input: { from_entry_id: 'dog', to_entry_id: 'perro', custom_type: { name: 'Compare' } }, user_id: 'u1' })
    const { custom_type_id } = db.prepare(`SELECT custom_type_id FROM entry_relationships WHERE id = ?`).get(relationship.id) as { custom_type_id: string }
    tombstone('relationship_types', custom_type_id)
    expect(relationship_count()).toBe(0)
  })
})

describe('api_key_id attribution', () => {
  let history_db: Database.Database

  beforeEach(() => { history_db = open_dictionary_history_db_in_memory() })
  afterEach(() => history_db.close())

  test('records the api_key_id on the relationship change (fanned to both entries)', () => {
    const { relationship } = apply_relationship_create({ db, history_db, input: { from_entry_id: 'dog', to_entry_id: 'perro', type: 'cognate' }, user_id: 'u1', api_key_id: 'key-1' })
    const row = history_db.prepare(`SELECT api_key_id FROM changes WHERE table_name = 'entry_relationships' AND row_id = ? LIMIT 1`).get(relationship.id) as { api_key_id: string | null } | undefined
    expect(row?.api_key_id).toBe('key-1')
  })
})

describe('source file has no raw NUL byte', () => {
  test('endpoint_key uses an escaped separator, not a raw NUL (keeps the file text, not binary)', () => {
    const source = readFileSync(new URL('./v1-relationship-write.ts', import.meta.url))
    expect(source).not.toContain(0x00)
  })
})
