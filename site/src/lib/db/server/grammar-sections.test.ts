import type Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { open_dictionary_db_in_memory } from './dictionary-db'
import {
  apply_clause_slot_delete,
  apply_clause_slot_update,
  apply_glossing_abbreviation_delete,
  apply_glossing_abbreviation_update,
  apply_section_delete,
  apply_section_update,
  create_clause_slot,
  create_section,
  find_or_create_glossing_abbreviation,
  get_section,
  link_section_sentence,
  list_clause_slots,
  list_entry_grammar_sections,
  list_glossing_abbreviations,
  list_sections,
  unlink_section_sentence,
} from './grammar-sections'
import { link_text_tag, list_text_tags, unlink_text_tag } from './v1-texts'

const NOW = '2026-07-14T00:00:00.000Z'
let db: Database.Database

beforeEach(() => {
  db = open_dictionary_db_in_memory('dict-1')
})
afterEach(() => db.close())

function seed(table: string, row: Record<string, unknown>) {
  const full = { created_by_user_id: 'u1', created_at: NOW, updated_by_user_id: 'u1', updated_at: NOW, ...row }
  const cols = Object.keys(full)
  db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(c => `@${c}`).join(', ')})`).run(full)
}
const seed_entry = (id: string) => seed('entries', { id, lexeme: JSON.stringify({ en: id }) })
const seed_sense = (id: string, entry_id: string) => seed('senses', { id, entry_id })
const seed_sentence = (id: string) => seed('sentences', { id, text: JSON.stringify({ default: id }) })
const seed_text = (id: string) => seed('texts', { id, title: JSON.stringify({ en: id }) })

const create = (input: Parameters<typeof create_section>[0]['input']) => create_section({ db, user_id: 'u1', input })

describe(create_section, () => {
  test('creates a section with a sort_key and audit', () => {
    const { section, created } = create({ title: 'Aspect', body: { en: 'The particle…' } })
    expect(created).toBeTruthy()
    expect(section.title).toEqual({ default: 'Aspect' })
    expect(section.body).toEqual({ en: 'The particle…' })
    expect(section.sort_key).toBeTruthy()
    const row = db.prepare(`SELECT created_by_user_id FROM grammar_sections WHERE id = ?`).get(section.id) as { created_by_user_id: string }
    expect(row.created_by_user_id).toBe('u1')
  })

  test('rejects a blank title', () => {
    expect(() => create({ title: '  ' })).toThrow(/title is required/)
  })

  test('is idempotent on a supplied id', () => {
    const id = crypto.randomUUID()
    const first = create({ id, title: 'One' })
    expect(first.created).toBeTruthy()
    const second = create({ id, title: 'Two' })
    expect(second.created).toBeFalsy()
    expect(second.section.title).toEqual({ default: 'One' })
  })

  test('rejects an unknown parent / entry / sense / slot', () => {
    expect(() => create({ title: 'x', parent_id: 'nope' })).toThrow(/parent section/)
    expect(() => create({ title: 'x', entry_id: 'nope' })).toThrow(/entry/)
    expect(() => create({ title: 'x', sense_id: 'nope' })).toThrow(/sense/)
    expect(() => create({ title: 'x', slot_id: 'nope' })).toThrow(/clause slot/)
  })

  test('links entry + example sentences by reference, in order', () => {
    seed_entry('e1')
    seed_sentence('s1')
    seed_sentence('s2')
    const { section } = create({ title: 'Neg', entry_id: 'e1', example_sentence_ids: ['s1', 's2'] })
    expect(section.entry_id).toBe('e1')
    expect(section.example_sentences.map(e => e.sentence_id)).toEqual(['s1', 's2'])
    expect(section.example_sentences[0].sort_key! < section.example_sentences[1].sort_key!).toBeTruthy()
  })

  test('nests children and orders siblings; after_section_id inserts between', () => {
    const root = create({ title: 'Root' }).section
    const a = create({ title: 'A', parent_id: root.id }).section
    const c = create({ title: 'C', parent_id: root.id }).section
    const b = create({ title: 'B', parent_id: root.id, after_section_id: a.id }).section
    const children = list_sections(db, { parent_id: root.id })
    expect(children.map(s => s.id)).toEqual([a.id, b.id, c.id])
    expect(get_section(db, root.id)!.child_ids).toEqual([a.id, b.id, c.id])
  })
})

describe(apply_section_update, () => {
  test('field-merges, clears a link with null, and reparents', () => {
    seed_entry('e1')
    const root = create({ title: 'Root' }).section
    const child = create({ title: 'Child', parent_id: root.id, entry_id: 'e1', number_label: '1.1' }).section

    const updated = apply_section_update({ db, section_id: child.id, user_id: 'u1', patch: { body: 'new body', entry_id: null } }).section!
    expect(updated.body).toEqual({ default: 'new body' })
    expect(updated.entry_id).toBe(null)
    expect(updated.number_label).toBe('1.1')

    const moved = apply_section_update({ db, section_id: child.id, user_id: 'u1', patch: { parent_id: null } }).section!
    expect(moved.parent_id).toBe(null)
    expect(get_section(db, root.id)!.child_ids).toEqual([])
  })

  test('returns found:false for a missing section', () => {
    expect(apply_section_update({ db, section_id: 'gone', user_id: 'u1', patch: { title: 'x' } }).found).toBeFalsy()
  })
})

describe(apply_section_delete, () => {
  test('cascades to descendants and detaches example links', () => {
    seed_sentence('s1')
    const root = create({ title: 'Root' }).section
    const child = create({ title: 'Child', parent_id: root.id, example_sentence_ids: ['s1'] }).section

    apply_section_delete({ db, section_id: root.id, user_id: 'u1' })
    expect(get_section(db, root.id)).toBeUndefined()
    expect(get_section(db, child.id)).toBeUndefined()
    expect(db.prepare(`SELECT COUNT(*) AS n FROM section_sentences`).get()).toEqual({ n: 0 })
    // the sentence itself survives
    expect(db.prepare(`SELECT id FROM sentences WHERE id = 's1'`).get()).toEqual({ id: 's1' })
  })
})

describe(link_section_sentence, () => {
  test('appends, inserts after, dedupes, and 404s on missing refs', () => {
    seed_sentence('s1')
    seed_sentence('s2')
    seed_sentence('s3')
    const { section } = create({ title: 'Sec' })

    link_section_sentence({ db, section_id: section.id, sentence_id: 's1', user_id: 'u1' })
    link_section_sentence({ db, section_id: section.id, sentence_id: 's3', user_id: 'u1' })
    link_section_sentence({ db, section_id: section.id, sentence_id: 's2', after_sentence_id: 's1', user_id: 'u1' })
    expect(get_section(db, section.id)!.example_sentences.map(e => e.sentence_id)).toEqual(['s1', 's2', 's3'])

    const dup = link_section_sentence({ db, section_id: section.id, sentence_id: 's1', user_id: 'u1' })
    expect(dup.created).toBeFalsy()

    const missing = link_section_sentence({ db, section_id: 'nope', sentence_id: 's1', user_id: 'u1' })
    expect(missing.found).toBeFalsy()
  })

  test('unlink removes the reference only', () => {
    seed_sentence('s1')
    const { section } = create({ title: 'Sec', example_sentence_ids: ['s1'] })
    const result = unlink_section_sentence({ db, section_id: section.id, sentence_id: 's1', user_id: 'u1' })
    expect(result.found).toBeTruthy()
    expect(get_section(db, section.id)!.example_sentences).toHaveLength(0)
    expect(db.prepare(`SELECT id FROM sentences WHERE id = 's1'`).get()).toEqual({ id: 's1' })
  })
})

describe(list_entry_grammar_sections, () => {
  test('finds sections linked by entry_id OR by a sense of the entry', () => {
    seed_entry('e1')
    seed_sense('sense1', 'e1')
    const byEntry = create({ title: 'By entry', entry_id: 'e1' }).section
    const bySense = create({ title: 'By sense', sense_id: 'sense1' }).section
    create({ title: 'Unrelated' })
    const found = list_entry_grammar_sections(db, 'e1').map(s => s.id).sort()
    expect(found).toEqual([byEntry.id, bySense.id].sort())
  })
})

describe(create_clause_slot, () => {
  test('creates ordered slots and clears slot_id on delete', () => {
    const pre = create_clause_slot({ db, user_id: 'u1', input: { name: 'pre-verb', code: 'pre_verb' } }).clause_slot
    const post = create_clause_slot({ db, user_id: 'u1', input: { name: 'post-verb' } }).clause_slot
    const mid = create_clause_slot({ db, user_id: 'u1', input: { name: 'verb', after_slot_id: pre.id } }).clause_slot
    expect(list_clause_slots(db).map(s => s.id)).toEqual([pre.id, mid.id, post.id])
    expect(pre.name).toEqual({ default: 'pre-verb' })

    const { section } = create({ title: 'Aspect', slot_id: pre.id })
    apply_clause_slot_delete({ db, slot_id: pre.id, user_id: 'u1' })
    expect(list_clause_slots(db).map(s => s.id)).toEqual([mid.id, post.id])
    expect(get_section(db, section.id)!.slot_id).toBe(null)
  })

  test('rename + recode via update', () => {
    const slot = create_clause_slot({ db, user_id: 'u1', input: { name: 'a' } }).clause_slot
    const updated = apply_clause_slot_update({ db, slot_id: slot.id, user_id: 'u1', input: { name: 'final', code: 'fin' } }).clause_slot!
    expect(updated.name).toEqual({ default: 'final' })
    expect(updated.code).toBe('fin')
  })
})

describe(find_or_create_glossing_abbreviation, () => {
  test('find-or-creates by code, updates, deletes', () => {
    const first = find_or_create_glossing_abbreviation({ db, user_id: 'u1', input: { code: '3PL', name: 'third person plural' } })
    expect(first.created).toBeTruthy()
    const again = find_or_create_glossing_abbreviation({ db, user_id: 'u1', input: { code: '3PL', name: 'dup' } })
    expect(again.created).toBeFalsy()
    expect(again.glossing_abbreviation.name).toEqual({ default: 'third person plural' })
    expect(list_glossing_abbreviations(db)).toHaveLength(1)

    apply_glossing_abbreviation_update({ db, code: '3PL', user_id: 'u1', input: { category: 'person' } })
    expect(list_glossing_abbreviations(db)[0].category).toBe('person')

    apply_glossing_abbreviation_delete({ db, code: '3PL', user_id: 'u1' })
    expect(list_glossing_abbreviations(db)).toHaveLength(0)
  })
})

describe(link_text_tag, () => {
  test('find-or-creates a kinded tag, links idempotently, lists, and unlinks', () => {
    seed_text('t1')
    const first = link_text_tag({ db, text_id: 't1', name: 'Trickster', kind: 'motif', code: 'K1', user_id: 'u1' })
    expect(first.created).toBeTruthy()
    expect(first.tag).toMatchObject({ name: 'Trickster', kind: 'motif', code: 'K1' })

    const again = link_text_tag({ db, text_id: 't1', name: 'trickster', kind: 'motif', user_id: 'u1' })
    expect(again.created).toBeFalsy()
    expect(again.tag!.id).toBe(first.tag!.id)
    expect(list_text_tags(db, 't1')).toHaveLength(1)

    unlink_text_tag({ db, text_id: 't1', tag_id: first.tag!.id, user_id: 'u1' })
    expect(list_text_tags(db, 't1')).toHaveLength(0)
    // the tag itself survives the unlink
    expect(db.prepare(`SELECT id FROM tags WHERE id = ?`).get(first.tag!.id)).toBeTruthy()
  })

  test('404s for a missing text', () => {
    expect(link_text_tag({ db, text_id: 'gone', name: 'x', user_id: 'u1' }).found).toBeFalsy()
  })
})
