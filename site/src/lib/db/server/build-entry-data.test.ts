import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { open_dictionary_db_in_memory } from './dictionary-db'
import { build_entry_data } from './build-entry-data'
import { stringify_dict_row } from '$lib/db/schemas/dictionary-json-columns'

let db: Database.Database
const NOW = '2024-01-01T00:00:00Z'

function insert(table: string, row: Record<string, unknown>) {
  const full = stringify_dict_row(table, {
    dirty: 0,
    created_by_user_id: 'u1',
    created_at: NOW,
    updated_by_user_id: 'u1',
    updated_at: NOW,
    ...row,
  })
  const columns = Object.keys(full)
  db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`)
    .run(...columns.map(column => full[column]))
}

beforeEach(() => {
  db = open_dictionary_db_in_memory('build_entry_test')
})

afterEach(() => {
  db.close()
})

describe(build_entry_data, () => {
  test('returns null for a missing entry', () => {
    expect(build_entry_data({ db, entry_id: 'nope', admin_level: 0 })).toBeNull()
  })

  test('assembles a full entry subgraph from the per-dict DB', () => {
    insert('entries', { id: 'e1', lexeme: { default: 'jaʼ' }, phonetic: 'xaʔ', elicitation_id: 'el-1' })
    insert('senses', { id: 's1', entry_id: 'e1', glosses: { en: 'water' }, parts_of_speech: ['n'], created_at: '2024-01-01T00:00:01Z' })

    insert('sentences', { id: 'st1', text: { default: 'drink water' }, translation: { en: 'drink water' } })
    insert('senses_in_sentences', { id: 'sis1', sense_id: 's1', sentence_id: 'st1' })

    insert('photos', { id: 'p1', storage_path: 'photos/p1', serving_url: 'lh3/p1' })
    insert('sense_photos', { id: 'sp1', sense_id: 's1', photo_id: 'p1' })

    insert('speakers', { id: 'spk1', name: 'Ada' })
    insert('audio', { id: 'a1', entry_id: 'e1', storage_path: 'audio/a1' })
    insert('audio_speakers', { id: 'as1', audio_id: 'a1', speaker_id: 'spk1' })

    insert('dialects', { id: 'd1', name: { default: 'Coastal' } })
    insert('entry_dialects', { id: 'ed1', entry_id: 'e1', dialect_id: 'd1' })

    const built = build_entry_data({ db, entry_id: 'e1', admin_level: 0 })
    expect(built).not.toBeNull()
    const entry = built as NonNullable<typeof built>

    expect(entry.id).toBe('e1')
    expect(entry.main.lexeme).toEqual({ default: 'jaʼ' })
    expect(entry.main).not.toHaveProperty('dictionary_id')
    expect(entry.main).not.toHaveProperty('dirty')

    expect(entry.senses).toHaveLength(1)
    expect(entry.senses[0]).not.toHaveProperty('entry_id')
    expect(entry.senses[0].glosses).toEqual({ en: 'water' })
    expect(entry.senses[0].sentences?.[0].text).toEqual({ default: 'drink water' })
    expect(entry.senses[0].photos?.[0].serving_url).toBe('lh3/p1')

    expect(entry.audios?.[0].storage_path).toBe('audio/a1')
    expect(entry.audios?.[0].speakers?.[0].name).toBe('Ada')

    expect(entry.dialects?.[0].name).toEqual({ default: 'Coastal' })
  })

  test('filters private tags by admin level', () => {
    insert('entries', { id: 'e1', lexeme: { default: 'jaʼ' } })
    insert('tags', { id: 't-pub', name: 'animals', private: 0 })
    insert('tags', { id: 't-priv', name: 'sensitive', private: 1 })
    insert('entry_tags', { id: 'et1', entry_id: 'e1', tag_id: 't-pub', created_at: '2024-01-01T00:00:01Z' })
    insert('entry_tags', { id: 'et2', entry_id: 'e1', tag_id: 't-priv', created_at: '2024-01-01T00:00:02Z' })

    const anon = build_entry_data({ db, entry_id: 'e1', admin_level: 0 })
    expect(anon?.tags?.map(tag => tag.id)).toEqual(['t-pub'])

    const admin = build_entry_data({ db, entry_id: 'e1', admin_level: 1 })
    expect(admin?.tags?.map(tag => tag.id)?.sort()).toEqual(['t-priv', 't-pub'])
  })
})
