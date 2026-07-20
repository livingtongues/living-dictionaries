import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { open_dictionary_db_in_memory } from './dictionary-db'
import { apply_text_update, create_text, get_text } from './v1-texts'
import { create_source } from './v1-sources'

let db: Database.Database

beforeEach(() => {
  db = open_dictionary_db_in_memory('dict-1')
})

afterEach(() => {
  db.close()
})

describe(create_text, () => {
  test('stores text-level metadata: sources, citations, summary, dialects, work_id', () => {
    create_source({ db, user_id: 'u1', input: { slug: 'hymnal-1962' } })
    const { text, created } = create_text({
      db,
      user_id: 'u1',
      input: {
        title: 'Hymn 12',
        sources: 'hymnal-1962',
        citations: [{ slug: 'hymnal-1962', locator: 'hymn 12' }],
        summary: { en: 'A hymn of praise' },
        dialects: ['Coastal'],
        work_id: 'hymn-12',
        sentences: [{ text: 'line one' }],
      },
    })
    expect(created).toBeTruthy()
    expect(text.sources).toEqual(['hymnal-1962'])
    expect(text.citations).toEqual([{ slug: 'hymnal-1962', locator: 'hymn 12' }])
    expect(text.summary).toEqual({ en: 'A hymn of praise' })
    expect(text.work_id).toBe('hymn-12')
    expect(text.dialects).toHaveLength(1)
    expect(text.dialects?.[0].name).toEqual({ default: 'Coastal' })
    expect(text.parallel_texts).toBeUndefined()
  })

  test('rejects an unknown source slug', () => {
    expect(() => create_text({ db, user_id: 'u1', input: { title: 'T', sources: ['nope'] } }))
      .toThrow(/unknown source slug/)
  })

  test('texts sharing a work_id read each other as parallel_texts', () => {
    const first = create_text({ db, user_id: 'u1', input: { title: { en: 'Hymn 12 (Coastal)' }, work_id: 'hymn-12', dialects: ['Coastal'] } })
    const second = create_text({ db, user_id: 'u1', input: { title: { en: 'Hymn 12 (Inland)' }, work_id: 'hymn-12', dialects: ['Inland'] } })
    const read = get_text(db, second.text.id)
    expect(read?.parallel_texts).toHaveLength(1)
    expect(read?.parallel_texts?.[0]).toMatchObject({ id: first.text.id, title: { en: 'Hymn 12 (Coastal)' } })
    expect(read?.parallel_texts?.[0].dialects[0].name).toEqual({ default: 'Coastal' })
    // dialect registry is shared + found-or-created, not duplicated
    expect((db.prepare(`SELECT COUNT(*) c FROM dialects`).get() as { c: number }).c).toBe(2)
  })
})

describe(apply_text_update, () => {
  test('overwrites metadata, clears with null, and adds dialect links additively', () => {
    create_source({ db, user_id: 'u1', input: { slug: 's1' } })
    const { text } = create_text({ db, user_id: 'u1', input: { title: 'T', summary: 'old', work_id: 'w1', dialects: ['A'] } })
    const result = apply_text_update({
      db,
      text_id: text.id,
      patch: { sources: ['s1'], citations: [{ slug: 's1', locator: '2' }], summary: null, work_id: null, dialects: ['B'] },
      user_id: 'u1',
    })
    expect(result.found).toBeTruthy()
    expect(result.text?.sources).toEqual(['s1'])
    expect(result.text?.citations).toEqual([{ slug: 's1', locator: '2' }])
    expect(result.text?.summary).toBeNull()
    expect(result.text?.work_id).toBeNull()
    expect(result.text?.dialects?.map(dialect => dialect.name.default).sort()).toEqual(['A', 'B'])
  })
})
