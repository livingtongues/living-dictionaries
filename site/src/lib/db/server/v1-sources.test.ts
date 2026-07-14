import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { open_dictionary_db_in_memory } from './dictionary-db'
import { open_dictionary_history_db_in_memory } from './dictionary-history-db'
import { apply_entry_writes } from './v1-entry-write'
import { attach_media } from './v1-media-write'
import { apply_source_delete, apply_source_update, count_source_references, create_source, list_sources, remove_source_from_all } from './v1-sources'

let db: Database.Database
let history_db: Database.Database

beforeEach(() => {
  db = open_dictionary_db_in_memory('dict-1')
  history_db = open_dictionary_history_db_in_memory()
})

afterEach(() => {
  db.close()
  history_db.close()
})

function count(table: string): number {
  return (db.prepare(`SELECT COUNT(*) AS c FROM "${table}"`).get() as { c: number }).c
}

describe(create_source, () => {
  test('creates a source and lists it', () => {
    create_source({ db, user_id: 'u1', input: { slug: 'smith-2020', citation: 'Smith 2020.', abbreviation: 'Smith 2020', type: 'dictionary' } })
    const sources = list_sources(db)
    expect(sources).toHaveLength(1)
    expect(sources[0]).toMatchObject({ slug: 'smith-2020', abbreviation: 'Smith 2020', type: 'dictionary' })
  })

  test('rejects a duplicate slug', () => {
    create_source({ db, user_id: 'u1', input: { slug: 'dup' } })
    expect(() => create_source({ db, user_id: 'u1', input: { slug: 'dup' } })).toThrow(/already exists/)
  })

  test('rejects an invalid type', () => {
    expect(() => create_source({ db, user_id: 'u1', input: { slug: 's', type: 'bogus' } })).toThrow(/invalid source type/)
  })

  test('requires a slug', () => {
    expect(() => create_source({ db, user_id: 'u1', input: { slug: '  ' } })).toThrow(/slug is required/)
  })

  test('stores the source orthography', () => {
    const { source } = create_source({ db, user_id: 'u1', input: { slug: 'rpa', orthography: 'rpa' } })
    expect(source.orthography).toBe('rpa')
    expect(list_sources(db)[0].orthography).toBe('rpa')
  })
})

describe(apply_source_update, () => {
  test('field-merges metadata', () => {
    const { source } = create_source({ db, user_id: 'u1', input: { slug: 's', citation: 'old' } })
    const result = apply_source_update({ db, source_id: source.id, patch: { citation: 'new', author: 'Smith' }, user_id: 'u2' })
    expect(result.found).toBeTruthy()
    const [updated] = list_sources(db)
    expect(updated).toMatchObject({ citation: 'new', author: 'Smith' })
  })

  test('patches the source orthography', () => {
    const { source } = create_source({ db, user_id: 'u1', input: { slug: 's' } })
    apply_source_update({ db, source_id: source.id, patch: { orthography: 'ipa' }, user_id: 'u1' })
    expect(list_sources(db)[0].orthography).toBe('ipa')
  })

  test('rejects renaming a slug onto an existing one', () => {
    create_source({ db, user_id: 'u1', input: { slug: 'a' } })
    const { source } = create_source({ db, user_id: 'u1', input: { slug: 'b' } })
    expect(() => apply_source_update({ db, source_id: source.id, patch: { slug: 'a' }, user_id: 'u1' })).toThrow(/already exists/)
  })
})

describe(count_source_references, () => {
  test('counts entries citing the slug', () => {
    create_source({ db, user_id: 'u1', input: { slug: 'h' } })
    apply_entry_writes({ db, user_id: 'u1', entries: [{ lexeme: 'a', sources: ['h'] }, { lexeme: 'b', sources: ['h'] }, { lexeme: 'c' }] })
    expect(count_source_references(db, 'h')).toEqual({ entries: 2, sentences: 0, texts: 0, audio: 0, videos: 0 })
  })

  test('counts audio/video rows whose scalar source is the slug', () => {
    create_source({ db, user_id: 'u1', input: { slug: 'h' } })
    apply_entry_writes({ db, user_id: 'u1', entries: [{ lexeme: 'a' }] })
    const entry = db.prepare(`SELECT id FROM entries`).get() as { id: string }
    attach_media({ db, cell_key: 'audio:entry', owner_id: entry.id, fields: { storage_path: 'a.mp3', source: 'h' }, user_id: 'u1' })
    expect(count_source_references(db, 'h')).toEqual({ entries: 0, sentences: 0, texts: 0, audio: 1, videos: 0 })
  })
})

describe(apply_source_delete, () => {
  test('refuses while referenced', () => {
    const { source } = create_source({ db, user_id: 'u1', input: { slug: 'h' } })
    apply_entry_writes({ db, user_id: 'u1', entries: [{ lexeme: 'a', sources: ['h'] }] })
    expect(() => apply_source_delete({ db, source_id: source.id, user_id: 'u1' })).toThrow(/still used by/)
    expect(count('sources')).toBe(1)
  })

  test('remove_source_from_all strips the slug, then delete succeeds', () => {
    const { source } = create_source({ db, user_id: 'u1', input: { slug: 'h' } })
    apply_entry_writes({ db, user_id: 'u1', entries: [{ lexeme: 'a', sources: ['h'] }] })
    remove_source_from_all({ db, history_db, slug: 'h', user_id: 'u1' })
    expect(count_source_references(db, 'h')).toEqual({ entries: 0, sentences: 0, texts: 0, audio: 0, videos: 0 })
    const entry = db.prepare(`SELECT sources FROM entries`).get() as { sources: string | null }
    expect(entry.sources).toBeNull()
    const result = apply_source_delete({ db, history_db, source_id: source.id, user_id: 'u1' })
    expect(result.found).toBeTruthy()
    expect(count('sources')).toBe(0)
  })

  test('refuses while an audio row references it; remove_source_from_all NULLs the media ref', () => {
    const { source } = create_source({ db, user_id: 'u1', input: { slug: 'h' } })
    apply_entry_writes({ db, user_id: 'u1', entries: [{ lexeme: 'a' }] })
    const entry = db.prepare(`SELECT id FROM entries`).get() as { id: string }
    attach_media({ db, cell_key: 'audio:entry', owner_id: entry.id, fields: { storage_path: 'a.mp3', source: 'h' }, user_id: 'u1' })
    expect(() => apply_source_delete({ db, source_id: source.id, user_id: 'u1' })).toThrow(/1 audio/)
    remove_source_from_all({ db, history_db, slug: 'h', user_id: 'u1' })
    const audio = db.prepare(`SELECT source, dirty FROM audio`).get() as { source: string | null, dirty: number | null }
    expect(audio.source).toBeNull()
    expect(apply_source_delete({ db, history_db, source_id: source.id, user_id: 'u1' }).found).toBeTruthy()
    expect(count('sources')).toBe(0)
  })

  test('returns found:false for an unknown source', () => {
    expect(apply_source_delete({ db, source_id: 'nope', user_id: 'u1' }).found).toBeFalsy()
  })
})
