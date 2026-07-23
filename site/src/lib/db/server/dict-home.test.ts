import { get_featured_cards, get_recent_cards } from './dict-home'
import { open_dictionary_db_in_memory } from './dictionary-db'

function seed_entry(db: ReturnType<typeof open_dictionary_db_in_memory>, options: { id: string, lexeme: string, created_at: string, with_photo?: boolean, with_audio?: boolean, gloss?: string, parts_of_speech?: string[], dialect?: string }) {
  const { id, lexeme, created_at, with_photo, with_audio, gloss, parts_of_speech, dialect } = options
  const audit = `'u1', '${created_at}', 'u1', '${created_at}'`
  db.prepare(`INSERT INTO entries (id, lexeme, created_by_user_id, created_at, updated_by_user_id, updated_at) VALUES (?, ?, ${audit})`).run(id, JSON.stringify({ default: lexeme }))
  db.prepare(`INSERT INTO senses (id, entry_id, glosses, parts_of_speech, created_by_user_id, created_at, updated_by_user_id, updated_at) VALUES (?, ?, ?, ?, ${audit})`).run(`${id}-s1`, id, gloss ? JSON.stringify({ en: gloss }) : null, parts_of_speech ? JSON.stringify(parts_of_speech) : null)
  if (dialect) {
    db.prepare(`INSERT INTO dialects (id, name, created_by_user_id, created_at, updated_by_user_id, updated_at) VALUES (?, ?, ${audit})`).run(`${id}-d1`, JSON.stringify({ default: dialect }))
    db.prepare(`INSERT INTO entry_dialects (id, entry_id, dialect_id, created_by_user_id, created_at, updated_by_user_id, updated_at) VALUES (?, ?, ?, ${audit})`).run(`${id}-ed1`, id, `${id}-d1`)
  }
  if (with_photo) {
    db.prepare(`INSERT INTO photos (id, storage_path, serving_url, created_by_user_id, created_at, updated_by_user_id, updated_at) VALUES (?, ?, ?, ${audit})`).run(`${id}-p1`, `photos/${id}.jpg`, `serving-${id}`)
    db.prepare(`INSERT INTO sense_photos (id, sense_id, photo_id, created_by_user_id, created_at, updated_by_user_id, updated_at) VALUES (?, ?, ?, ${audit})`).run(`${id}-sp1`, `${id}-s1`, `${id}-p1`)
  }
  if (with_audio)
    db.prepare(`INSERT INTO audio (id, entry_id, storage_path, created_by_user_id, created_at, updated_by_user_id, updated_at) VALUES (?, ?, ?, ${audit})`).run(`${id}-a1`, id, `audio/${id}.mp3`)
}

function star_entry(db: ReturnType<typeof open_dictionary_db_in_memory>, options: { id: string, entry_id: string, sort_key: string }) {
  const { id, entry_id, sort_key } = options
  db.prepare(`INSERT INTO featured_entries (id, entry_id, sort_key, created_by_user_id, created_at, updated_by_user_id, updated_at) VALUES (?, ?, ?, 'u1', '2026-07-04T00:00:00.000Z', 'u1', '2026-07-04T00:00:00.000Z')`).run(id, entry_id, sort_key)
}

describe(get_featured_cards, () => {
  test('returns starred entries in sort_key order with first photo/audio/gloss', () => {
    const db = open_dictionary_db_in_memory('test-dict')
    seed_entry(db, { id: 'e1', lexeme: 'apple', created_at: '2026-01-01T00:00:00.000Z', with_photo: true, with_audio: true, gloss: 'fruit', parts_of_speech: ['n'], dialect: 'Northern' })
    seed_entry(db, { id: 'e2', lexeme: 'bird', created_at: '2026-01-02T00:00:00.000Z' })
    star_entry(db, { id: 'f1', entry_id: 'e1', sort_key: 'm' })
    star_entry(db, { id: 'f2', entry_id: 'e2', sort_key: 'a' })

    const cards = get_featured_cards({ db })
    expect(cards).toHaveLength(2)
    expect(cards[0]).toEqual({
      id: 'f2',
      entry_id: 'e2',
      lexeme: { default: 'bird' },
      phonetic: null,
      glosses: null,
      parts_of_speech: null,
      dialect: null,
      photo_serving_url: null,
      photo_storage_path: null,
      audio_storage_path: null,
    })
    expect(cards[1]).toEqual({
      id: 'f1',
      entry_id: 'e1',
      lexeme: { default: 'apple' },
      phonetic: null,
      glosses: { en: 'fruit' },
      parts_of_speech: ['n'],
      dialect: 'Northern',
      photo_serving_url: 'serving-e1',
      photo_storage_path: 'photos/e1.jpg',
      audio_storage_path: 'audio/e1.mp3',
    })
  })

  test('unstarring via a deletes tombstone removes the card (cascade trigger)', () => {
    const db = open_dictionary_db_in_memory('test-dict')
    seed_entry(db, { id: 'e1', lexeme: 'apple', created_at: '2026-01-01T00:00:00.000Z' })
    star_entry(db, { id: 'f1', entry_id: 'e1', sort_key: 'm' })
    db.prepare(`INSERT INTO deletes (table_name, id) VALUES ('featured_entries', 'f1')`).run()
    expect(get_featured_cards({ db })).toEqual([])
  })

  test('deleting the entry cascades away the featured row', () => {
    const db = open_dictionary_db_in_memory('test-dict')
    seed_entry(db, { id: 'e1', lexeme: 'apple', created_at: '2026-01-01T00:00:00.000Z' })
    star_entry(db, { id: 'f1', entry_id: 'e1', sort_key: 'm' })
    db.prepare(`INSERT INTO deletes (table_name, id) VALUES ('entries', 'e1')`).run()
    expect(get_featured_cards({ db })).toEqual([])
    expect(db.prepare('SELECT COUNT(*) AS n FROM featured_entries').get()).toEqual({ n: 0 })
  })

  test('rejects a second star for the same entry (UNIQUE natural key)', () => {
    const db = open_dictionary_db_in_memory('test-dict')
    seed_entry(db, { id: 'e1', lexeme: 'apple', created_at: '2026-01-01T00:00:00.000Z' })
    star_entry(db, { id: 'f1', entry_id: 'e1', sort_key: 'm' })
    expect(() => star_entry(db, { id: 'f2', entry_id: 'e1', sort_key: 'x' })).toThrow(/UNIQUE/)
  })
})

describe(get_recent_cards, () => {
  test('returns newest entries first, capped at limit', () => {
    const db = open_dictionary_db_in_memory('test-dict')
    seed_entry(db, { id: 'e1', lexeme: 'oldest', created_at: '2026-01-01T00:00:00.000Z' })
    seed_entry(db, { id: 'e2', lexeme: 'middle', created_at: '2026-01-02T00:00:00.000Z' })
    seed_entry(db, { id: 'e3', lexeme: 'newest', created_at: '2026-01-03T00:00:00.000Z' })

    const cards = get_recent_cards({ db, limit: 2 })
    expect(cards.map(card => card.lexeme.default)).toEqual(['newest', 'middle'])
    expect(cards[0].entry_id).toBe('e3')
  })
})
