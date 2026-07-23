import type Database from 'better-sqlite3'
import type { SentenceTokens } from '$lib/db/schemas/dictionary.types'
import { open_dictionary_db_in_memory } from '$lib/db/server/dictionary-db'
import { apply_form_action, apply_token_actions, get_dictionary_suggestions } from './v1-suggestions'
import { merge_dict_row } from './dictionary-sync-helpers'

let db: Database.Database

beforeEach(() => {
  db = open_dictionary_db_in_memory('test-dict')
})

afterEach(() => db.close())

const user_id = 'agent-1'
const at = new Date().toISOString()

function seed_entry(lexeme_default: string): string {
  const id = crypto.randomUUID()
  merge_dict_row({ db, table_name: 'entries', row: { id, lexeme: { default: lexeme_default }, created_at: at, updated_at: at }, user_id })
  return id
}

function seed_sense(entry_id: string): string {
  const id = crypto.randomUUID()
  merge_dict_row({ db, table_name: 'senses', row: { id, entry_id, created_at: at, updated_at: at }, user_id })
  return id
}

function seed_sentence({ text, tokens, text_id }: { text: string, tokens: SentenceTokens, text_id?: string }): string {
  const id = crypto.randomUUID()
  if (text_id)
    merge_dict_row({ db, table_name: 'texts', row: { id: text_id, title: { default: 'T' }, created_at: at, updated_at: at }, user_id })
  merge_dict_row({ db, table_name: 'sentences', row: { id, text: { default: text }, tokens, text_id: text_id ?? null, sort_key: text_id ? 'a' : null, created_at: at, updated_at: at }, user_id })
  return id
}

function stored_tokens(sentence_id: string): SentenceTokens {
  const row = db.prepare('SELECT tokens FROM sentences WHERE id = ?').get(sentence_id) as { tokens: string }
  return JSON.parse(row.tokens)
}

describe(get_dictionary_suggestions, () => {
  test('aggregates unmatched/ambiguous/ignored across sentences + the ignore list', () => {
    seed_sentence({ text: 'Ri kaq', tokens: { default: [
      { form: 'Ri', start: 0, end: 2 },
      { form: 'kaq', start: 3, end: 6, candidates: ['e1', 'e2'] },
    ] } })
    seed_sentence({ text: 'ri!', tokens: { default: [
      { form: 'ri', start: 0, end: 2 },
      { form: '!', start: 2, end: 3, status: 'ignored' },
    ] } })
    db.prepare(`INSERT INTO ignored_forms (id, form, created_by_user_id, updated_by_user_id) VALUES ('if1', 'zzz', 'u', 'u')`).run()

    const facets = get_dictionary_suggestions(db)
    expect(facets.unmatched.map(row => [row.key, row.count])).toEqual([['ri', 2]])
    expect(facets.ambiguous.map(row => [row.key, row.candidates])).toEqual([['kaq', ['e1', 'e2']]])
    expect(facets.ignored.map(row => [row.key, row.count, row.everywhere ?? false])).toEqual([['zzz', 0, true]])
  })
})

describe(apply_token_actions, () => {
  test('confirm with sense mirrors the junction; unlink cleans it (text sentences)', () => {
    const entry_id = seed_entry('nak')
    const sense_id = seed_sense(entry_id)
    const sentence_id = seed_sentence({
      text: 'Nak',
      text_id: crypto.randomUUID(),
      tokens: { default: [{ form: 'Nak', start: 0, end: 3 }] },
    })

    const confirm = apply_token_actions({
      db, sentence_id, user_id,
      actions: [{ orthography: 'default', token_index: 0, action: 'confirm', entry_id, sense_id }],
    })
    expect(confirm.found).toBeTruthy()
    expect(stored_tokens(sentence_id).default[0]).toEqual({ form: 'Nak', start: 0, end: 3, entry_id, sense_id, status: 'confirmed' })
    expect(db.prepare('SELECT COUNT(*) c FROM senses_in_sentences WHERE sentence_id = ? AND sense_id = ?').get(sentence_id, sense_id)).toEqual({ c: 1 })

    apply_token_actions({
      db, sentence_id, user_id,
      actions: [{ orthography: 'default', token_index: 0, action: 'unlink' }],
    })
    expect(stored_tokens(sentence_id).default[0]).toEqual({ form: 'Nak', start: 0, end: 3 })
    expect(db.prepare('SELECT COUNT(*) c FROM senses_in_sentences').get()).toEqual({ c: 0 })
  })

  test('unknown sentence → found false; bad token or missing entry throws', () => {
    expect(apply_token_actions({ db, sentence_id: 'nope', user_id, actions: [] }).found).toBeFalsy()
    const sentence_id = seed_sentence({ text: 'Nak', tokens: { default: [{ form: 'Nak', start: 0, end: 3 }] } })
    expect(() => apply_token_actions({ db, sentence_id, user_id, actions: [{ orthography: 'default', token_index: 9, action: 'ignore' }] }))
      .toThrow('token not found')
    expect(() => apply_token_actions({ db, sentence_id, user_id, actions: [{ orthography: 'default', token_index: 0, action: 'confirm', entry_id: 'ghost' }] }))
      .toThrow('valid entry_id')
  })
})

describe(apply_form_action, () => {
  test('ignore marks occurrences + persists; restore lifts + re-matches', () => {
    const entry_id = seed_entry('kaq')
    const sentence_id = seed_sentence({ text: 'kaq zuq', tokens: { default: [
      { form: 'kaq', start: 0, end: 3, entry_id, status: 'auto' },
      { form: 'zuq', start: 4, end: 7 },
    ] } })

    const ignore = apply_form_action({ db, action: 'ignore', form: 'KAQ', user_id })
    expect(ignore).toMatchObject({ found: true, sentences_changed: 1, occurrences: 1 })
    expect(stored_tokens(sentence_id).default[0]).toEqual({ form: 'kaq', start: 0, end: 3, status: 'ignored' })
    expect(db.prepare(`SELECT COUNT(*) c FROM ignored_forms WHERE form = 'kaq'`).get()).toEqual({ c: 1 })

    const restore = apply_form_action({ db, action: 'restore', form: 'kaq', user_id })
    expect(restore).toMatchObject({ found: true, sentences_changed: 1, occurrences: 1 })
    expect(stored_tokens(sentence_id).default[0]).toEqual({ form: 'kaq', start: 0, end: 3, entry_id, status: 'auto' })
    expect(db.prepare(`SELECT COUNT(*) c FROM ignored_forms`).get()).toEqual({ c: 0 })
  })

  test('link confirms every occurrence entry-level with no junction rows; create_entry mints + links', () => {
    const entry_id = seed_entry('zuq')
    const first = seed_sentence({ text: 'Zuq nak', tokens: { default: [
      { form: 'Zuq', start: 0, end: 3 },
      { form: 'nak', start: 4, end: 7 },
    ] } })

    const link = apply_form_action({ db, action: 'link', form: 'zuq', entry_id, user_id })
    expect(link).toMatchObject({ sentences_changed: 1, occurrences: 1 })
    expect(stored_tokens(first).default[0]).toEqual({ form: 'Zuq', start: 0, end: 3, entry_id, status: 'confirmed' })
    expect(db.prepare('SELECT COUNT(*) c FROM senses_in_sentences').get()).toEqual({ c: 0 })

    const created = apply_form_action({ db, action: 'create_entry', form: 'nak', lexeme: { default: 'nak' }, user_id })
    expect(created.entry_id).toBeDefined()
    expect(stored_tokens(first).default[1]).toEqual({ form: 'nak', start: 4, end: 7, entry_id: created.entry_id, status: 'confirmed' })
    expect(db.prepare('SELECT COUNT(*) c FROM senses WHERE entry_id = ?').get(created.entry_id)).toEqual({ c: 1 })

    expect(() => apply_form_action({ db, action: 'link', form: 'nak', entry_id: 'ghost', user_id })).toThrow('valid entry_id')
    expect(() => apply_form_action({ db, action: 'create_entry', form: 'x', lexeme: {}, user_id })).toThrow('requires a lexeme')
  })
})
