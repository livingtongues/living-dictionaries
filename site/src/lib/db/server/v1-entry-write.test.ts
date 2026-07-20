import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { open_dictionary_db_in_memory } from './dictionary-db'
import { open_dictionary_history_db_in_memory } from './dictionary-history-db'
import * as sync_helpers from './dictionary-sync-helpers'
import { apply_entry_delete, apply_entry_update, apply_entry_writes, apply_sentence_update, read_sentence_record } from './v1-entry-write'
import { create_source } from './v1-sources'

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

describe(apply_entry_writes, () => {
  test('creates a full entry: lexeme, sense glosses, example sentence', () => {
    const report = apply_entry_writes({
      db,
      history_db,
      user_id: 'u1',
      entries: [{
        lexeme: 'mbwa',
        phonetic: 'mˈbwa',
        senses: [{
          glosses: { en: 'dog', es: 'perro' },
          parts_of_speech: 'n',
          example_sentences: [{ text: 'Mbwa wangu', translation: { en: 'My dog' } }],
        }],
      }],
    })

    expect(report).toMatchObject({ created: 1, skipped: 0, failed: 0, updated: 0 })
    expect(report.results[0]).toMatchObject({ status: 'created' })
    expect(report.results[0].entry_id).toBeTruthy()
    expect(report.results[0].sense_ids).toHaveLength(1)

    const entry = db.prepare(`SELECT * FROM entries WHERE id = ?`).get(report.results[0].entry_id) as Record<string, string>
    expect(JSON.parse(entry.lexeme)).toEqual({ default: 'mbwa' })
    expect(entry.phonetic).toBe('mˈbwa')
    expect(entry.created_by_user_id).toBe('u1')
    expect(entry.updated_by_user_id).toBe('u1')

    const sense = db.prepare(`SELECT * FROM senses WHERE entry_id = ?`).get(report.results[0].entry_id) as Record<string, string>
    expect(JSON.parse(sense.glosses)).toEqual({ en: 'dog', es: 'perro' })
    expect(JSON.parse(sense.parts_of_speech)).toEqual(['n'])

    expect(count('sentences')).toBe(1)
    expect(count('senses_in_sentences')).toBe(1)
    const sentence = db.prepare(`SELECT * FROM sentences`).get() as Record<string, string>
    expect(JSON.parse(sentence.text)).toEqual({ default: 'Mbwa wangu' })
    expect(JSON.parse(sentence.translation)).toEqual({ en: 'My dog' })
  })

  test('defaults to one empty sense when none provided', () => {
    const report = apply_entry_writes({ db, user_id: 'u1', entries: [{ lexeme: 'word' }] })
    expect(report.created).toBe(1)
    expect(count('senses')).toBe(1)
  })

  test('per-item best-effort: a bad row fails alone, the rest commit', () => {
    const report = apply_entry_writes({
      db,
      user_id: 'u1',
      entries: [
        { lexeme: 'good1' },
        { lexeme: '' } as never, // missing lexeme → fails
        { lexeme: 'good2' },
      ],
    })
    expect(report).toMatchObject({ created: 2, failed: 1 })
    expect(report.results[1].status).toBe('failed')
    expect(report.results[1].error).toMatch(/lexeme/)
    expect(count('entries')).toBe(2)
  })

  test('normalizes parts_of_speech to canonical lowercase abbrevs, deduped; unknown values pass through', () => {
    const report = apply_entry_writes({
      db,
      user_id: 'u1',
      entries: [{
        lexeme: 'mbwa',
        senses: [{ parts_of_speech: ['N', 'Noun', 'CONJ', 'sustantivo poseido'] }],
      }],
    })
    const sense = db.prepare(`SELECT * FROM senses WHERE entry_id = ?`).get(report.results[0].entry_id) as Record<string, string>
    expect(JSON.parse(sense.parts_of_speech)).toEqual(['n', 'conj', 'sustantivo poseido'])
  })

  test('deduplicates dialects + tags by name across entries', () => {
    apply_entry_writes({
      db,
      user_id: 'u1',
      entries: [
        { lexeme: 'a', dialects: ['Coastal'], tags: ['flora'] },
        { lexeme: 'b', dialects: ['coastal'], tags: ['Flora'] }, // case-insensitive dupes
      ],
    })
    expect(count('dialects')).toBe(1)
    expect(count('tags')).toBe(1)
    expect(count('entry_dialects')).toBe(2)
    expect(count('entry_tags')).toBe(2)
  })

  test('import_id creates a private tag attached to every entry', () => {
    const report = apply_entry_writes({
      db,
      user_id: 'u1',
      import_id: 'batch-2026',
      entries: [{ lexeme: 'x' }, { lexeme: 'y' }],
    })
    expect(report.created).toBe(2)
    const tag = db.prepare(`SELECT * FROM tags WHERE name = ?`).get('batch-2026') as Record<string, number>
    expect(tag.private).toBe(1)
    expect(count('entry_tags')).toBe(2)
  })

  test('bumps last_modified_at so the change syncs', () => {
    const before = db.prepare(`SELECT value FROM db_metadata WHERE key = 'last_modified_at'`).get() as { value: string } | undefined
    const report = apply_entry_writes({ db, user_id: 'u1', entries: [{ lexeme: 'sync-me' }] })
    expect(report.new_synced_up_to).toBeTruthy()
    expect(report.new_synced_up_to).not.toBe(before?.value)
  })

  test('records change history for created entries', () => {
    apply_entry_writes({ db, history_db, user_id: 'u1', entries: [{ lexeme: 'hist', senses: [{ glosses: { en: 'history' } }] }] })
    const entry_inserts = history_db.prepare(`SELECT COUNT(*) AS c FROM changes WHERE table_name = 'entries' AND op = 'insert'`).get() as { c: number }
    expect(entry_inserts.c).toBe(1)
  })

  // Regression (N1): when the entry row commits but a LATER row in the same item
  // throws, `ROLLBACK TO v1_item` undoes the DB rows — the item's staged history
  // events must be discarded too, not recorded as phantom `changes`.
  test('discards staged history for an item whose later row fails after the entry merged', () => {
    const real_merge = sync_helpers.merge_dict_row
    let merge_calls = 0
    const spy = vi.spyOn(sync_helpers, 'merge_dict_row').mockImplementation((args) => {
      merge_calls++
      if (merge_calls === 2) // 1 = entries row (committed), 2 = senses row → fail mid-item
        throw new Error('forced failure on the second row')
      return real_merge(args)
    })

    try {
      const report = apply_entry_writes({ db, history_db, user_id: 'u1', entries: [{ lexeme: 'doomed', senses: [{ glosses: { en: 'x' } }] }] })

      expect(report).toMatchObject({ created: 0, failed: 1 })
      // The entry row was rolled back with the savepoint.
      expect(count('entries')).toBe(0)
      // And NO phantom history was recorded for the never-committed item.
      const changes = history_db.prepare(`SELECT COUNT(*) AS c FROM changes`).get() as { c: number }
      expect(changes.c).toBe(0)
    } finally {
      spy.mockRestore()
    }
  })
})

describe('strict source-slug validation', () => {
  test('rejects an entry citing an unknown source slug (reported in failed)', () => {
    const report = apply_entry_writes({ db, history_db, user_id: 'u1', entries: [{ lexeme: 'x', sources: ['smith-2020'] }] })
    expect(report).toMatchObject({ created: 0, failed: 1 })
    expect(report.results[0].error).toMatch(/unknown source slug 'smith-2020'/)
    expect(count('entries')).toBe(0)
  })

  test('accepts a known slug and stores it on the entry', () => {
    create_source({ db, user_id: 'u1', input: { slug: 'smith-2020', citation: 'Smith 2020.' } })
    const report = apply_entry_writes({ db, history_db, user_id: 'u1', entries: [{ lexeme: 'x', sources: ['smith-2020'] }] })
    expect(report).toMatchObject({ created: 1, failed: 0 })
    const entry = db.prepare(`SELECT sources FROM entries WHERE id = ?`).get(report.results[0].entry_id) as { sources: string }
    expect(JSON.parse(entry.sources)).toEqual(['smith-2020'])
  })

  test('PATCH rejects an unknown source slug', () => {
    const report = apply_entry_writes({ db, user_id: 'u1', entries: [{ lexeme: 'x' }] })
    const entry_id = report.results[0].entry_id as string
    expect(() => apply_entry_update({ db, entry_id, patch: { sources: ['ghost'] }, user_id: 'u1' })).toThrow(/unknown source slug 'ghost'/)
  })

  test('sentence write rejects an unknown source slug', () => {
    const report = apply_entry_writes({ db, history_db, user_id: 'u1', entries: [{ lexeme: 'x', senses: [{ glosses: { en: 'y' }, example_sentences: [{ text: 'hi', sources: ['ghost'] }] }] }] })
    expect(report).toMatchObject({ created: 0, failed: 1 })
    expect(report.results[0].error).toMatch(/unknown source slug 'ghost'/)
  })
})

function seed_entry(): { entry_id: string, sense_id: string } {
  const report = apply_entry_writes({ db, user_id: 'u1', entries: [{ lexeme: 'mbwa', senses: [{ glosses: { en: 'dog' } }] }] })
  return { entry_id: report.results[0].entry_id as string, sense_id: report.results[0].sense_ids?.[0] as string }
}

describe(apply_entry_update, () => {
  test('returns found:false for an unknown entry', () => {
    expect(apply_entry_update({ db, entry_id: 'nope', patch: { phonetic: 'x' }, user_id: 'u1' }).found).toBeFalsy()
  })

  test('field-merges entry scalars, leaving omitted fields intact', () => {
    const { entry_id } = seed_entry()
    apply_entry_update({ db, entry_id, patch: { phonetic: 'mˈbwa' }, user_id: 'u2' })
    const entry = db.prepare(`SELECT * FROM entries WHERE id = ?`).get(entry_id) as Record<string, string>
    expect(entry.phonetic).toBe('mˈbwa')
    expect(JSON.parse(entry.lexeme)).toEqual({ default: 'mbwa' }) // untouched
    expect(entry.updated_by_user_id).toBe('u2')
  })

  test('updates an existing sense by id and adds a new sense', () => {
    const { entry_id, sense_id } = seed_entry()
    apply_entry_update({ db, entry_id, patch: {
      senses: [
        { id: sense_id, glosses: { en: 'hound' }, parts_of_speech: ['n'] },
        { glosses: { en: 'puppy' } },
      ],
    }, user_id: 'u1' })
    const senses = db.prepare(`SELECT * FROM senses WHERE entry_id = ? ORDER BY created_at`).all(entry_id) as Record<string, string>[]
    expect(senses).toHaveLength(2)
    expect(JSON.parse(senses[0].glosses)).toEqual({ en: 'hound' })
    expect(JSON.parse(senses[0].parts_of_speech)).toEqual(['n'])
  })

  test('normalizes parts_of_speech in a sense patch', () => {
    const { entry_id, sense_id } = seed_entry()
    apply_entry_update({ db, entry_id, patch: { senses: [{ id: sense_id, parts_of_speech: ['V', 'Verb', 'OBJ'] }] }, user_id: 'u1' })
    const sense = db.prepare(`SELECT * FROM senses WHERE id = ?`).get(sense_id) as Record<string, string>
    expect(JSON.parse(sense.parts_of_speech)).toEqual(['v', 'obj'])
  })

  test('appends an example sentence to an existing sense', () => {
    const { entry_id, sense_id } = seed_entry()
    apply_entry_update({ db, entry_id, patch: { senses: [{ id: sense_id, example_sentences: [{ text: 'Mbwa', translation: { en: 'Dog' } }] }] }, user_id: 'u1' })
    expect((db.prepare(`SELECT COUNT(*) c FROM sentences`).get() as { c: number }).c).toBe(1)
    expect((db.prepare(`SELECT COUNT(*) c FROM senses_in_sentences`).get() as { c: number }).c).toBe(1)
  })

  test('adds dialect/tag links additively without duplicating', () => {
    const { entry_id } = seed_entry()
    apply_entry_update({ db, entry_id, patch: { dialects: ['Coastal'], tags: ['fauna'] }, user_id: 'u1' })
    apply_entry_update({ db, entry_id, patch: { dialects: ['coastal'], tags: ['Fauna'] }, user_id: 'u1' }) // dupes
    expect(count('dialects')).toBe(1)
    expect(count('entry_dialects')).toBe(1)
    expect(count('tags')).toBe(1)
    expect(count('entry_tags')).toBe(1)
  })

  test('upserts a sense by unknown client id: creates it WITH that id (deterministic import ids)', () => {
    const { entry_id } = seed_entry()
    const deterministic_id = crypto.randomUUID()
    apply_entry_update({ db, entry_id, patch: { senses: [{ id: deterministic_id, glosses: { en: 'puppy' } }] }, user_id: 'u1' })
    const sense = db.prepare(`SELECT * FROM senses WHERE id = ?`).get(deterministic_id) as Record<string, string>
    expect(sense.entry_id).toBe(entry_id)
    expect(JSON.parse(sense.glosses)).toEqual({ en: 'puppy' })

    // Re-PATCH with the same id → field-merge, not a duplicate or an error.
    apply_entry_update({ db, entry_id, patch: { senses: [{ id: deterministic_id, glosses: { en: 'pup' } }] }, user_id: 'u1' })
    expect(count('senses')).toBe(2) // the seeded sense + the upserted one
    const merged = db.prepare(`SELECT glosses FROM senses WHERE id = ?`).get(deterministic_id) as { glosses: string }
    expect(JSON.parse(merged.glosses)).toEqual({ en: 'pup' })
  })

  test('a deterministic-id re-PATCH with sentences is idempotent (no duplicate links)', () => {
    const { entry_id } = seed_entry()
    const sense_id = crypto.randomUUID()
    const sentence_id = crypto.randomUUID()
    const patch = { senses: [{ id: sense_id, glosses: { en: 'puppy' }, example_sentences: [{ id: sentence_id, text: 'Mbwa mdogo', translation: { en: 'Small dog' } }] }] }
    apply_entry_update({ db, entry_id, patch, user_id: 'u1' })
    apply_entry_update({ db, entry_id, patch, user_id: 'u1' })
    expect(count('sentences')).toBe(1)
    expect(count('senses_in_sentences')).toBe(1)
  })

  test('throws when a sense id belongs to a different entry', () => {
    const { sense_id } = seed_entry()
    const other = apply_entry_writes({ db, user_id: 'u1', entries: [{ lexeme: 'paka' }] })
    const other_entry_id = other.results[0].entry_id as string
    expect(() => apply_entry_update({ db, entry_id: other_entry_id, patch: { senses: [{ id: sense_id, glosses: { en: 'x' } }] }, user_id: 'u1' }))
      .toThrow(/belongs to a different entry/)
  })

  test('throws on a malformed sense id', () => {
    const { entry_id } = seed_entry()
    expect(() => apply_entry_update({ db, entry_id, patch: { senses: [{ id: 'not-a-uuid', glosses: { en: 'x' } }] }, user_id: 'u1' }))
      .toThrow(/sense id must be a valid UUID/)
  })
})

describe('entry coordinates', () => {
  const point = { coordinates: { longitude: 77.2, latitude: 28.6 }, label: 'Khirsu' }

  test('POST persists valid points + regions, and a bad geometry fails ONLY that item', () => {
    const ring = [{ longitude: 0, latitude: 0 }, { longitude: 1, latitude: 1 }, { longitude: 2, latitude: 0 }]
    const report = apply_entry_writes({ db, user_id: 'u1', entries: [
      { lexeme: 'good', coordinates: { points: [point], regions: [{ coordinates: ring }] } },
      { lexeme: 'bad', coordinates: { points: [{ coordinates: { longitude: 999, latitude: 0 } }] } },
    ] })
    expect(report.created).toBe(1)
    expect(report.failed).toBe(1)
    expect(report.results[1].error).toMatch(/longitude must be between/)
    const good = db.prepare(`SELECT coordinates FROM entries WHERE id = ?`).get(report.results[0].entry_id) as { coordinates: string }
    expect(JSON.parse(good.coordinates)).toEqual({ points: [point], regions: [{ coordinates: ring }] })
  })

  test('POST rejects over the point cap for that item', () => {
    const many = Array.from({ length: 101 }, () => ({ coordinates: { longitude: 0, latitude: 0 } }))
    const report = apply_entry_writes({ db, user_id: 'u1', entries: [{ lexeme: 'x', coordinates: { points: many } }] })
    expect(report.failed).toBe(1)
    expect(report.results[0].error).toMatch(/at most 100 points/)
  })

  test('PATCH replaces coordinates, clears with null, and leaves them untouched when omitted', () => {
    const report = apply_entry_writes({ db, user_id: 'u1', entries: [{ lexeme: 'geo', coordinates: { points: [point] } }] })
    const entry_id = report.results[0].entry_id as string

    const next = { coordinates: { longitude: 10, latitude: 20 } }
    apply_entry_update({ db, entry_id, patch: { coordinates: { points: [next] } }, user_id: 'u1' })
    let row = db.prepare(`SELECT coordinates, phonetic FROM entries WHERE id = ?`).get(entry_id) as { coordinates: string, phonetic: string | null }
    expect(JSON.parse(row.coordinates)).toEqual({ points: [next] })

    // Omitted → untouched (a scalar-only patch keeps the geometry).
    apply_entry_update({ db, entry_id, patch: { phonetic: 'ɡeoʊ' }, user_id: 'u1' })
    row = db.prepare(`SELECT coordinates, phonetic FROM entries WHERE id = ?`).get(entry_id) as { coordinates: string, phonetic: string | null }
    expect(JSON.parse(row.coordinates)).toEqual({ points: [next] })
    expect(row.phonetic).toBe('ɡeoʊ')

    // null → cleared.
    apply_entry_update({ db, entry_id, patch: { coordinates: null }, user_id: 'u1' })
    row = db.prepare(`SELECT coordinates, phonetic FROM entries WHERE id = ?`).get(entry_id) as { coordinates: string, phonetic: string | null }
    expect(row.coordinates).toBe(null)
  })

  test('PATCH with an invalid geometry throws (route maps to 400)', () => {
    const report = apply_entry_writes({ db, user_id: 'u1', entries: [{ lexeme: 'z' }] })
    const entry_id = report.results[0].entry_id as string
    expect(() => apply_entry_update({ db, entry_id, patch: { coordinates: { regions: [{ coordinates: [{ longitude: 0, latitude: 0 }] }] } }, user_id: 'u1' }))
      .toThrow(/at least 3 vertices/)
  })
})

describe('IGT sentence writes (tokens / gloss / citations / discourse)', () => {
  function seed_sentence_with_igt() {
    create_source({ db, user_id: 'u1', input: { slug: 'smith-1981' } })
    const { entry_id, sense_id } = seed_entry()
    apply_entry_update({ db, entry_id, patch: { senses: [{ id: sense_id, example_sentences: [{
      text: 'na na bird',
      translation: { en: 'the bird flew' },
      tokens: { default: [{ form: 'na' }, { form: 'na', gloss: '3PL' }, { form: 'bird', gloss: { en: 'bird' }, entry_id }] },
      citations: [{ slug: 'smith-1981', locator: '1981:31' }],
      example_label: '(2a)',
      discourse_role: 'storyline',
    }] }] }, user_id: 'u1' })
    const row = db.prepare(`SELECT * FROM sentences`).get() as Record<string, string>
    return { row, entry_id }
  }

  test('stores derived token offsets, gloss default-key, citations, label, and discourse_role', () => {
    const { row } = seed_sentence_with_igt()
    const tokens = JSON.parse(row.tokens)
    expect(tokens.default.map((t: { start: number, end: number }) => [t.start, t.end])).toEqual([[0, 2], [3, 5], [6, 10]])
    expect(tokens.default[1].gloss).toEqual({ default: '3PL' })
    expect(tokens.default[2].gloss).toEqual({ en: 'bird' })
    expect(JSON.parse(row.citations)).toEqual([{ slug: 'smith-1981', locator: '1981:31' }])
    expect(row.example_label).toBe('(2a)')
    expect(row.discourse_role).toBe('storyline')
  })

  test('rejects a citation slug that is not a known source', () => {
    const { entry_id, sense_id } = seed_entry()
    const report = apply_entry_writes({ db, user_id: 'u1', entries: [{ lexeme: 'x', senses: [{ glosses: { en: 'y' }, example_sentences: [{ text: 'hi', citations: [{ slug: 'ghost' }] }] }] }] })
    expect(report.results[0].status).toBe('failed')
    expect(report.results[0].error).toMatch(/ghost/)
    void entry_id
    void sense_id
  })

  test('rejects an invalid discourse_role', () => {
    const { entry_id, sense_id } = seed_entry()
    const report = apply_entry_writes({ db, user_id: 'u1', entries: [{ lexeme: 'z', senses: [{ glosses: { en: 'y' }, example_sentences: [{ text: 'hi', discourse_role: 'bogus' }] }] }] })
    expect(report.results[0].status).toBe('failed')
    expect(report.results[0].error).toMatch(/invalid discourse_role/)
    void entry_id
    void sense_id
  })

  test('a tokens-only sentence synthesizes its text by joining forms', () => {
    const { entry_id, sense_id } = seed_entry()
    apply_entry_update({ db, entry_id, patch: { senses: [{ id: sense_id, example_sentences: [{ tokens: { default: [{ form: 'kaq' }, { form: 'sii', gloss: { en: 'dog' } }] } }] }] }, user_id: 'u1' })
    const row = db.prepare(`SELECT * FROM sentences ORDER BY created_at DESC LIMIT 1`).get() as Record<string, string>
    expect(JSON.parse(row.text)).toEqual({ default: 'kaq sii' })
  })

  test('PATCH re-derives tokens and exposes IGT fields on the read record', () => {
    const { row } = seed_sentence_with_igt()
    apply_sentence_update({ db, sentence_id: row.id, patch: { discourse_role: null, tokens: { default: [{ form: 'na' }, { form: 'na' }, { form: 'bird' }] } }, user_id: 'u1' })
    const record = read_sentence_record(db, row.id)
    expect(record?.discourse_role).toBeNull()
    expect(record?.tokens?.default).toHaveLength(3)
    expect(record?.citations).toEqual([{ slug: 'smith-1981', locator: '1981:31' }])
    expect(record?.example_label).toBe('(2a)')
  })
})

describe(apply_entry_delete, () => {
  test('returns found:false for an unknown entry', () => {
    expect(apply_entry_delete({ db, entry_id: 'nope', user_id: 'u1' }).found).toBeFalsy()
  })

  test('hard-deletes the entry and FK-cascades senses + junctions', () => {
    const { entry_id } = seed_entry()
    apply_entry_update({ db, entry_id, patch: { senses: [{ glosses: { en: 'x' }, example_sentences: [{ text: 'a' }] }] }, user_id: 'u1' })
    const result = apply_entry_delete({ db, history_db, entry_id, user_id: 'u1' })
    expect(result.found).toBeTruthy()
    expect(count('entries')).toBe(0)
    expect(count('senses')).toBe(0)
    // Junction goes (FK cascade off senses); the standalone sentence row survives
    // — sentences are independent (can belong to a text / other senses), matching
    // the existing human-delete behavior.
    expect(count('senses_in_sentences')).toBe(0)
    const del = history_db.prepare(`SELECT COUNT(*) c FROM changes WHERE op = 'delete' AND table_name = 'entries'`).get() as { c: number }
    expect(del.c).toBe(1)
  })
})

describe('quick-wins fields: homograph, entry citations, sense sources', () => {
  function seed_source(slug: string) {
    create_source({ db, user_id: 'u1', input: { slug } })
  }

  test('create stores homograph, entry citations, and sense sources', () => {
    seed_source('smith-1979')
    const report = apply_entry_writes({
      db,
      user_id: 'u1',
      entries: [{
        lexeme: 'caws',
        homograph: '3',
        sources: ['smith-1979'],
        citations: [{ slug: 'smith-1979', locator: 'p. 12' }],
        senses: [{ glosses: { en: 'squeeze' }, sources: ['smith-1979'] }],
      }],
    })
    expect(report).toMatchObject({ created: 1, failed: 0 })
    const entry = db.prepare(`SELECT * FROM entries`).get() as Record<string, string>
    expect(entry.homograph).toBe('3')
    expect(JSON.parse(entry.citations)).toEqual([{ slug: 'smith-1979', locator: 'p. 12' }])
    const sense = db.prepare(`SELECT * FROM senses`).get() as Record<string, string>
    expect(JSON.parse(sense.sources)).toEqual(['smith-1979'])
  })

  test('unknown citation / sense source slugs fail the item', () => {
    const bad_citation = apply_entry_writes({ db, user_id: 'u1', entries: [{ lexeme: 'a', citations: [{ slug: 'nope' }] }] })
    expect(bad_citation.results[0]).toMatchObject({ status: 'failed' })
    expect(bad_citation.results[0].error).toMatch(/unknown source slug/)
    const bad_sense = apply_entry_writes({ db, user_id: 'u1', entries: [{ lexeme: 'b', senses: [{ sources: 'nope' }] }] })
    expect(bad_sense.results[0]).toMatchObject({ status: 'failed' })
  })

  test('patch overwrites homograph + citations and replaces sense sources', () => {
    seed_source('s1')
    seed_source('s2')
    const report = apply_entry_writes({ db, user_id: 'u1', entries: [{ lexeme: 'x', homograph: '1', citations: [{ slug: 's1', locator: '3' }], senses: [{ id: crypto.randomUUID(), sources: ['s1'] }] }] })
    const entry_id = report.results[0].entry_id as string
    const sense_id = report.results[0].sense_ids?.[0] as string
    apply_entry_update({ db, entry_id, patch: { homograph: '2', citations: [{ slug: 's2' }], senses: [{ id: sense_id, sources: ['s2'] }] }, user_id: 'u1' })
    const entry = db.prepare(`SELECT * FROM entries WHERE id = ?`).get(entry_id) as Record<string, string>
    expect(entry.homograph).toBe('2')
    expect(JSON.parse(entry.citations)).toEqual([{ slug: 's2' }])
    const sense = db.prepare(`SELECT * FROM senses WHERE id = ?`).get(sense_id) as Record<string, string>
    expect(JSON.parse(sense.sources)).toEqual(['s2'])
  })
})
