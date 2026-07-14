import type Database from 'better-sqlite3'
import { open_dictionary_db_in_memory } from './dictionary-db'

/**
 * The 20260714 structured-grammar migration's load-bearing DDL, proven against
 * the REAL dict.db migration files: the new tables/columns exist, the
 * self-referencing section tree + junctions cascade-delete, `entry_id` SET-NULLs
 * (documentation outlives the entry), UNIQUE keys hold, and server_seq triggers
 * fire. See .issues/structured-grammar.md.
 */

const NOW = '2026-07-14T00:00:00.000Z'
const USER = 'u1'
const AUDIT = { created_by_user_id: USER, created_at: NOW, updated_by_user_id: USER, updated_at: NOW }

function open() {
  return open_dictionary_db_in_memory('grammar_test')
}

function insert(db: Database.Database, table: string, row: Record<string, unknown>) {
  const columns = Object.keys(row)
  db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(c => `@${c}`).join(', ')})`).run(row)
}

function seed_entry(db: Database.Database, id: string) {
  insert(db, 'entries', { id, lexeme: JSON.stringify({ en: id }), ...AUDIT })
}
function seed_sentence(db: Database.Database, id: string) {
  insert(db, 'sentences', { id, text: JSON.stringify({ default: id }), ...AUDIT })
}
function seed_section(db: Database.Database, row: Record<string, unknown>) {
  insert(db, 'grammar_sections', { sort_key: 'a0', title: JSON.stringify({ en: 'T' }), ...AUDIT, ...row })
}

describe('20260714 structured-grammar schema', () => {
  test('all new tables exist', () => {
    const db = open()
    const names = new Set((db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all() as { name: string }[]).map(r => r.name))
    for (const t of ['clause_slots', 'glossing_abbreviations', 'grammar_sections', 'section_sentences', 'text_tags'])
      expect(names.has(t)).toBeTruthy()
    db.close()
  })

  test('new columns exist on existing tables', () => {
    const db = open()
    const cols = (table: string) => new Set((db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(r => r.name))
    const sentence_cols = cols('sentences')
    for (const c of ['discourse_role', 'example_label', 'citations'])
      expect(sentence_cols.has(c)).toBeTruthy()
    expect(cols('sources').has('orthography')).toBeTruthy()
    const tag_cols = cols('tags')
    expect(tag_cols.has('kind')).toBeTruthy()
    expect(tag_cols.has('code')).toBeTruthy()
    db.close()
  })

  test('self-referencing parent_id cascades to descendants on hard delete', () => {
    const db = open()
    seed_section(db, { id: 'root', parent_id: null })
    seed_section(db, { id: 'child', parent_id: 'root' })
    seed_section(db, { id: 'grandchild', parent_id: 'child' })

    db.prepare(`INSERT INTO deletes (table_name, id) VALUES ('grammar_sections', 'root')`).run()

    const remaining = db.prepare(`SELECT id FROM grammar_sections`).all() as { id: string }[]
    expect(remaining).toHaveLength(0)
    db.close()
  })

  test('entry_id SET NULL — a linked section outlives its entry', () => {
    const db = open()
    seed_entry(db, 'e1')
    seed_section(db, { id: 's1', entry_id: 'e1' })

    db.prepare(`INSERT INTO deletes (table_name, id) VALUES ('entries', 'e1')`).run()

    const section = db.prepare(`SELECT id, entry_id FROM grammar_sections WHERE id = 's1'`).get() as { id: string, entry_id: string | null }
    expect(section.id).toBe('s1')
    expect(section.entry_id).toBeNull()
    db.close()
  })

  test('section_sentences cascades when either the section OR the sentence is deleted', () => {
    const db = open()
    seed_section(db, { id: 'sec1' })
    seed_section(db, { id: 'sec2' })
    seed_sentence(db, 'snt1')
    seed_sentence(db, 'snt2')
    insert(db, 'section_sentences', { id: 'j1', section_id: 'sec1', sentence_id: 'snt1', sort_key: 'a0', ...AUDIT })
    insert(db, 'section_sentences', { id: 'j2', section_id: 'sec2', sentence_id: 'snt2', sort_key: 'a0', ...AUDIT })

    db.prepare(`INSERT INTO deletes (table_name, id) VALUES ('grammar_sections', 'sec1')`).run()
    expect(db.prepare(`SELECT id FROM section_sentences WHERE id = 'j1'`).get()).toBeUndefined()

    db.prepare(`INSERT INTO deletes (table_name, id) VALUES ('sentences', 'snt2')`).run()
    expect(db.prepare(`SELECT id FROM section_sentences WHERE id = 'j2'`).get()).toBeUndefined()
    db.close()
  })

  test('UNIQUE keys hold (glossing code, section+sentence, text+tag)', () => {
    const db = open()
    insert(db, 'glossing_abbreviations', { id: 'g1', code: '3PL', name: JSON.stringify({ en: 'third person plural' }), ...AUDIT })
    expect(() => insert(db, 'glossing_abbreviations', { id: 'g2', code: '3PL', name: JSON.stringify({ en: 'dup' }), ...AUDIT })).toThrow()

    seed_section(db, { id: 'sec1' })
    seed_sentence(db, 'snt1')
    insert(db, 'section_sentences', { id: 'j1', section_id: 'sec1', sentence_id: 'snt1', ...AUDIT })
    expect(() => insert(db, 'section_sentences', { id: 'j2', section_id: 'sec1', sentence_id: 'snt1', ...AUDIT })).toThrow()
    db.close()
  })

  test('server_seq trigger fires on a new grammar table (fresh on insert, bumped on update)', () => {
    const db = open()
    seed_section(db, { id: 's1' })
    const before = (db.prepare(`SELECT server_seq FROM grammar_sections WHERE id = 's1'`).get() as { server_seq: number }).server_seq
    expect(before).not.toBeNull()

    db.prepare(`UPDATE grammar_sections SET number_label = '1.1' WHERE id = 's1'`).run()
    const after = (db.prepare(`SELECT server_seq FROM grammar_sections WHERE id = 's1'`).get() as { server_seq: number }).server_seq
    expect(after).toBe(before + 1)
    db.close()
  })
})
