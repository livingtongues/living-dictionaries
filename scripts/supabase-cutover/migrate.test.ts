import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { insert_rows, set_last_modified_to_max } from './db-insert'
import {
  build_dict_sources,
  build_sentence_order,
  DICT_JSON_COLS,
  map_audio,
  map_dictionary,
  map_dictionary_partner,
  map_dictionary_role,
  map_entry,
  map_invite,
  map_junction,
  map_orthographies,
  map_sense,
  map_sentence,
  map_speaker,
  map_text,
  map_user,
  resolve_audio_source_names,
  rewrite_orthography_keys,
  SHARED_JSON_COLS,
  to_int,
  to_iso,
} from './mappers'
import { open_dict_db, open_shared_db } from './open-sqlite'

describe('orthography mapping', () => {
  test('maps legacy orthographies to coded registry + lo→code map', () => {
    const { orthographies, lo_to_code } = map_orthographies([
      { bcp: 'sat-Latn', name: { default: 'Latin' } },
      { bcp: 'sat-Olck', name: { default: 'Ol Chiki' } },
    ])
    expect(orthographies).toEqual([
      { code: 'sat-Latn', name: 'Latin', bcp: 'sat-Latn' },
      { code: 'sat-Olck', name: 'Ol Chiki', bcp: 'sat-Olck' },
    ])
    expect(lo_to_code).toEqual({ lo1: 'sat-Latn', lo2: 'sat-Olck' })
  })

  test('falls back to a name slug when there is no bcp, and de-dupes codes', () => {
    const { orthographies, lo_to_code } = map_orthographies([
      { bcp: '', name: { default: 'Village Spelling' } },
      { bcp: '', name: 'Village Spelling' },
    ])
    expect(orthographies).toEqual([
      { code: 'village-spelling', name: 'Village Spelling' },
      { code: 'village-spelling-2', name: 'Village Spelling' },
    ])
    expect(lo_to_code).toEqual({ lo1: 'village-spelling', lo2: 'village-spelling-2' })
  })

  test('null/empty legacy → null registry', () => {
    expect(map_orthographies(null)).toEqual({ orthographies: null, lo_to_code: {} })
    expect(map_orthographies([])).toEqual({ orthographies: null, lo_to_code: {} })
  })

  test('rewrites lexeme/text keys, leaving default + unknown keys intact', () => {
    const lo_to_code = { lo1: 'sat-Latn', lo2: 'sat-Olck' }
    expect(rewrite_orthography_keys({ default: 'foo', lo1: 'bar', lo2: 'baz' }, lo_to_code)).toEqual({
      default: 'foo',
      'sat-Latn': 'bar',
      'sat-Olck': 'baz',
    })
    expect(rewrite_orthography_keys(null, lo_to_code)).toBe(null)
  })
})

describe('primitive transforms', () => {
  test('to_iso handles Date, string, null', () => {
    expect(to_iso(new Date('2024-01-02T03:04:05.000Z'))).toBe('2024-01-02T03:04:05.000Z')
    expect(to_iso('2024-01-02T03:04:05Z')).toBe('2024-01-02T03:04:05Z')
    expect(to_iso(null)).toBeNull()
    expect(to_iso(undefined)).toBeNull()
  })

  test('to_int maps boolean → 0/1/null', () => {
    expect(to_int(true)).toBe(1)
    expect(to_int(false)).toBe(0)
    expect(to_int(null)).toBeNull()
  })
})

describe('mapper transforms', () => {
  test('map_entry renames created_by → created_by_user_id, drops dictionary_id', () => {
    const out = map_entry({
      id: 'e1',
      dictionary_id: 'd1',
      lexeme: { en: 'hello' },
      created_by: 'u1',
      created_at: new Date('2024-01-01T00:00:00Z'),
      updated_by: 'u2',
      updated_at: new Date('2024-02-01T00:00:00Z'),
      deleted: null,
    })
    expect(out).not.toHaveProperty('dictionary_id')
    expect(out).not.toHaveProperty('created_by')
    expect(out.created_by_user_id).toBe('u1')
    expect(out.updated_by_user_id).toBe('u2')
    expect(out.created_at).toBe('2024-01-01T00:00:00.000Z')
    expect(out.dirty).toBeNull()
  })

  test('map_junction generates a UUID PK + keeps the natural key', () => {
    const out = map_junction(
      { sense_id: 's1', sentence_id: 'x1', dictionary_id: 'd1', created_by: 'u1', created_at: new Date('2024-01-01T00:00:00Z'), deleted: null },
      ['sense_id', 'sentence_id'],
    )
    expect(out.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(out.sense_id).toBe('s1')
    expect(out.sentence_id).toBe('x1')
    expect(out.updated_by_user_id).toBe('u1') // falls back to created_by
    expect(out.updated_at).toBe('2024-01-01T00:00:00.000Z')
  })

  test('map_user falls back to an email provider when no identities', () => {
    const out = map_user({ auth_user: { id: 'u1', email: 'a@b.com', created_at: new Date() }, providers: [] })
    expect(out.providers).toEqual([{ provider: 'email', provider_id: 'a@b.com' }])
  })

  test('build_dict_sources: distinct strings → registry rows + slug refs', () => {
    const citation = 'Smith, Jane. 2020. Example Language Dictionary.'
    const entries = [
      { id: 'e1', sources: [citation], created_by_user_id: 'u1' },
      { id: 'e2', sources: [citation, 'Lee 1998'], created_by_user_id: 'u1' },
      { id: 'e3', sources: null, created_by_user_id: 'u1' },
    ]
    const source_rows = build_dict_sources({ entry_rows: entries, user_id: 'u1' })
    // one registry row per distinct string
    expect(source_rows).toHaveLength(2)
    const primary = source_rows.find(s => s.citation === citation)!
    expect(primary.slug).toBe('smith-jane-2020-example-language-dictionary')
    expect(primary.created_by_user_id).toBe('u1')
    // entries rewritten to slugs
    expect(entries[0].sources).toEqual([primary.slug])
    expect(entries[1].sources).toEqual([primary.slug, 'lee-1998'])
    expect(entries[2].sources).toBeNull()
  })

  test('build_dict_sources: suffixes colliding slugs', () => {
    const entries = [{ id: 'e1', sources: ['A/B', 'A B'], created_by_user_id: 'u1' }]
    const rows = build_dict_sources({ entry_rows: entries, user_id: 'u1' })
    expect(rows.map(r => r.slug)).toEqual(['a-b', 'a-b-2'])
    expect(entries[0].sources).toEqual(['a-b', 'a-b-2'])
  })

  test('map_dictionary merges dictionary_info + converts booleans', () => {
    const out = map_dictionary({
      dict: { id: 'd1', name: 'Test', url: 'test', public: true, print_access: false, created_by: 'u1', created_at: new Date('2024-01-01T00:00:00Z') },
      info: { about: 'About text', citation: 'Cite', grammar: 'Gram', write_in_collaborators: ['Jo'] },
      entry_count: 5,
    })
    expect(out.public).toBe(1)
    expect(out.print_access).toBe(0)
    expect(out.about).toBe('About text')
    expect(out.write_in_collaborators).toEqual(['Jo'])
    expect(out.entry_count).toBe(5)
  })
})

describe(resolve_audio_source_names, () => {
  function audio_row({ id, source, created_by = 'u1' }: { id: string, source: string | null, created_by?: string }) {
    return map_audio({ id, entry_id: 'e1', storage_path: `${id}.mp3`, source, created_by, created_at: new Date('2024-01-01T00:00:00Z') })
  }
  const speaker_ana = { id: 'sp-ana', name: 'Ana Marija' }

  test('rule 1: name matches an in-dict speaker → links missing rows, NULLs source', () => {
    const audio_rows = [audio_row({ id: 'a1', source: 'ana marija ' }), audio_row({ id: 'a2', source: 'Ana Marija' })]
    const junction_rows = [map_junction({ audio_id: 'a2', speaker_id: 'sp-ana', created_by: 'u1', created_at: new Date() }, ['audio_id', 'speaker_id'])]
    const resolution = resolve_audio_source_names({ audio_rows, speaker_rows: [speaker_ana], junction_rows, existing_slugs: new Set(), user_id: 'u1' })
    expect(resolution.new_speakers).toHaveLength(0)
    expect(resolution.new_sources).toHaveLength(0)
    // only a1 needs the link — a2 already has it
    expect(resolution.new_audio_speakers).toHaveLength(1)
    expect(resolution.new_audio_speakers[0].audio_id).toBe('a1')
    expect(resolution.new_audio_speakers[0].speaker_id).toBe('sp-ana')
    expect(audio_rows[0].source).toBeNull()
    expect(audio_rows[1].source).toBeNull()
  })

  test('rule 2: no match + all rows speaker-less → creates ONE speaker, links all, collapses case variants', () => {
    const audio_rows = [
      audio_row({ id: 'a1', source: 'Yafeth Warijo' }),
      audio_row({ id: 'a2', source: 'Yafeth Warijo' }),
      audio_row({ id: 'a3', source: 'YAFETH WARIJO' }),
    ]
    const resolution = resolve_audio_source_names({ audio_rows, speaker_rows: [], junction_rows: [], existing_slugs: new Set(), user_id: 'u1' })
    expect(resolution.new_speakers).toHaveLength(1)
    expect(resolution.new_speakers[0].name).toBe('Yafeth Warijo') // most frequent variant wins
    expect(resolution.new_sources).toHaveLength(0)
    expect(resolution.new_audio_speakers).toHaveLength(3)
    for (const row of audio_rows)
      expect(row.source).toBeNull()
  })

  test('rule 3: rows linked to OTHER speakers → registry citation, source rewritten to slug', () => {
    const audio_rows = [audio_row({ id: 'a1', source: 'Daniel Bögre Udell' }), audio_row({ id: 'a2', source: 'Daniel Bögre Udell' })]
    const junction_rows = [map_junction({ audio_id: 'a1', speaker_id: 'sp-other', created_by: 'u1', created_at: new Date() }, ['audio_id', 'speaker_id'])]
    const existing_slugs = new Set(['daniel-bogre-udell'])
    const resolution = resolve_audio_source_names({ audio_rows, speaker_rows: [{ id: 'sp-other', name: 'Someone Else' }], junction_rows, existing_slugs, user_id: 'u1' })
    expect(resolution.new_speakers).toHaveLength(0)
    expect(resolution.new_audio_speakers).toHaveLength(0)
    expect(resolution.new_sources).toHaveLength(1)
    expect(resolution.new_sources[0].slug).toBe('daniel-bogre-udell-2') // collision-suffixed against entry sources
    expect(resolution.new_sources[0].citation).toBe('Daniel Bögre Udell')
    expect(audio_rows[0].source).toBe('daniel-bogre-udell-2')
    expect(audio_rows[1].source).toBe('daniel-bogre-udell-2')
  })

  test('ignores deleted rows and rows without a source', () => {
    const deleted = audio_row({ id: 'a1', source: 'Ghost Person' })
    deleted.deleted = '2024-01-01T00:00:00.000Z'
    const audio_rows = [deleted, audio_row({ id: 'a2', source: null })]
    const resolution = resolve_audio_source_names({ audio_rows, speaker_rows: [], junction_rows: [], existing_slugs: new Set(), user_id: 'u1' })
    expect(resolution.new_speakers).toHaveLength(0)
    expect(resolution.new_sources).toHaveLength(0)
    expect(resolution.new_audio_speakers).toHaveLength(0)
    expect(deleted.source).toBe('Ghost Person')
  })

  test('synthesized rows share the column set of mapped rows (batch-insert safe)', () => {
    const audio_rows = [audio_row({ id: 'a1', source: 'New Person' })]
    const resolution = resolve_audio_source_names({ audio_rows, speaker_rows: [], junction_rows: [], existing_slugs: new Set(), user_id: 'u1' })
    const mapped_speaker = map_speaker({ id: 'sp1', name: 'X', created_by: 'u1', created_at: new Date() })
    expect(Object.keys(resolution.new_speakers[0]).sort()).toEqual(Object.keys(mapped_speaker).sort())
    const mapped_junction = map_junction({ audio_id: 'a', speaker_id: 'b', created_by: 'u1', created_at: new Date() }, ['audio_id', 'speaker_id'])
    expect(Object.keys(resolution.new_audio_speakers[0]).sort()).toEqual(Object.keys(mapped_junction).sort())
  })
})

describe('end-to-end: migrations run + rows insert + JSON round-trips', () => {
  let data_dir: string

  beforeAll(() => {
    data_dir = mkdtempSync(join(tmpdir(), 'ld-migrate-test-'))
  })
  afterAll(() => {
    rmSync(data_dir, { recursive: true, force: true })
  })

  test('shared.db: users, dictionaries (+info), roles, partners, invites', () => {
    const db = open_shared_db(data_dir)

    insert_rows({ db, table: 'users', json_cols: SHARED_JSON_COLS.users, rows: [
      map_user({ auth_user: { id: 'u1', email: 'a@b.com', created_at: new Date('2024-01-01T00:00:00Z') }, profile: { full_name: 'Alice', avatar_url: 'http://x/a.png' }, providers: [{ provider: 'google', provider_id: 'g-123' }] }),
    ] })

    insert_rows({ db, table: 'dictionaries', json_cols: SHARED_JSON_COLS.dictionaries, rows: [
      map_dictionary({ dict: { id: 'd1', name: 'Test Dict', url: 'test', public: true, gloss_languages: ['en', 'es'], coordinates: { points: [] }, created_by: 'u1', created_at: new Date('2024-01-01T00:00:00Z') }, info: { about: 'Hi', write_in_collaborators: ['Bob'] }, entry_count: 1 }),
    ] })

    insert_rows({ db, table: 'dictionary_roles', rows: [
      map_dictionary_role({ dictionary_id: 'd1', user_id: 'u1', role: 'manager', created_at: new Date('2024-01-01T00:00:00Z') }),
    ] })

    insert_rows({ db, table: 'dictionary_partners', rows: [
      map_dictionary_partner({ partner: { id: 'p1', dictionary_id: 'd1', name: 'Partner Org', created_at: new Date('2024-01-01T00:00:00Z') }, photo: { storage_path: 'partners/p1.jpg', serving_url: 'http://img/p1' } }),
    ] })

    insert_rows({ db, table: 'invites', rows: [
      map_invite({ id: 'i1', dictionary_id: 'd1', created_by: 'u1', inviter_email: 'a@b.com', target_email: 'c@d.com', role: 'contributor', status: 'sent', created_at: new Date('2024-01-01T00:00:00Z') }),
    ] })

    expect((db.prepare('SELECT COUNT(*) c FROM users').get() as any).c).toBe(1)
    expect((db.prepare('SELECT COUNT(*) c FROM dictionaries').get() as any).c).toBe(1)
    expect((db.prepare('SELECT COUNT(*) c FROM dictionary_roles').get() as any).c).toBe(1)
    expect((db.prepare('SELECT COUNT(*) c FROM dictionary_partners').get() as any).c).toBe(1)
    expect((db.prepare('SELECT COUNT(*) c FROM invites').get() as any).c).toBe(1)

    const dict = db.prepare('SELECT * FROM dictionaries WHERE id = ?').get('d1') as any
    expect(JSON.parse(dict.gloss_languages)).toEqual(['en', 'es'])
    expect(JSON.parse(dict.write_in_collaborators)).toEqual(['Bob'])
    expect(dict.public).toBe(1)
    const partner = db.prepare('SELECT * FROM dictionary_partners WHERE id = ?').get('p1') as any
    expect(partner.photo_serving_url).toBe('http://img/p1')
    db.close()
  })

  test('dict.db: entries, texts, senses, sentences (text_id), audio (text_id), junctions', () => {
    const db = open_dict_db({ data_dir, dict_id: 'd1', rebuild: true })

    const base = { dictionary_id: 'd1', created_by: 'u1', created_at: new Date('2024-01-01T00:00:00Z'), updated_by: 'u1', updated_at: new Date('2024-01-02T00:00:00Z'), deleted: null }

    insert_rows({ db, table: 'entries', json_cols: DICT_JSON_COLS.entries, rows: [
      map_entry({ id: 'e1', lexeme: { en: 'hello', es: 'hola' }, sources: ['book'], notes: { en: 'a note' }, ...base }),
    ] })
    const source_texts = [{ id: 't1', title: { en: 'A Story' }, sentences: ['x1', { paragraph_break: true }], ...base }]
    insert_rows({ db, table: 'texts', json_cols: DICT_JSON_COLS.texts, rows: source_texts.map(map_text) })
    insert_rows({ db, table: 'senses', json_cols: DICT_JSON_COLS.senses, rows: [
      map_sense({ id: 'se1', entry_id: 'e1', glosses: { en: 'greeting' }, parts_of_speech: ['n'], semantic_domains: ['1.1'], ...base }),
    ] })
    // Mirror migrate.ts: derive per-sentence order from the texts, apply to sentence rows.
    const sentence_order = build_sentence_order(source_texts)
    const sentence_row = map_sentence({ id: 'x1', text: { en: 'Hello world' }, translation: { es: 'Hola mundo' }, text_id: 't1', ...base })
    Object.assign(sentence_row, sentence_order.get('x1'))
    insert_rows({ db, table: 'sentences', json_cols: DICT_JSON_COLS.sentences, rows: [sentence_row] })
    insert_rows({ db, table: 'speakers', rows: [
      map_junction({ id: 'spk1', name: 'Speaker', ...base }, ['name']),
    ] })
    insert_rows({ db, table: 'audio', rows: [
      map_audio({ id: 'au1', entry_id: 'e1', text_id: 't1', storage_path: 'audio/au1.mp3', ...base }),
    ] })
    insert_rows({ db, table: 'senses_in_sentences', rows: [
      map_junction({ sense_id: 'se1', sentence_id: 'x1', ...base }, ['sense_id', 'sentence_id']),
    ] })

    set_last_modified_to_max({ db, tables: ['entries', 'texts', 'senses', 'sentences', 'audio'] })

    expect((db.prepare('SELECT COUNT(*) c FROM entries').get() as any).c).toBe(1)
    expect((db.prepare('SELECT COUNT(*) c FROM texts').get() as any).c).toBe(1)

    const entry = db.prepare('SELECT * FROM entries WHERE id = ?').get('e1') as any
    expect(JSON.parse(entry.lexeme)).toEqual({ en: 'hello', es: 'hola' })
    expect(JSON.parse(entry.sources)).toEqual(['book'])

    const sentence = db.prepare('SELECT * FROM sentences WHERE id = ?').get('x1') as any
    expect(sentence.text_id).toBe('t1')
    expect(typeof sentence.sort_key).toBe('string')
    expect(sentence.sort_key.length).toBeGreaterThan(0)
    expect(sentence.ends_paragraph).toBe(1)

    const audio = db.prepare('SELECT * FROM audio WHERE id = ?').get('au1') as any
    expect(audio.text_id).toBe('t1')

    // FK integrity: the senses_in_sentences row resolves to real rows
    const joined = db.prepare(`
      SELECT s.id FROM senses_in_sentences sis
      JOIN senses s ON s.id = sis.sense_id
      JOIN sentences se ON se.id = sis.sentence_id
    `).get() as any
    expect(joined.id).toBe('se1')

    const lmod = db.prepare(`SELECT value FROM db_metadata WHERE key = 'last_modified_at'`).get() as any
    expect(lmod.value).toBe('2024-01-02T00:00:00.000Z')
    db.close()
  })
})

describe('build_sentence_order', () => {
  test('legacy id-array → ascending fractional keys + paragraph flags', () => {
    const order = build_sentence_order([
      { id: 't1', sentences: ['s1', 's2', { paragraph_break: true }, 's3'] },
    ])
    expect([...order.keys()]).toEqual(['s1', 's2', 's3'])
    // Keys sort in reading order.
    const keys = ['s1', 's2', 's3'].map(id => order.get(id)!.sort_key)
    expect([...keys].sort()).toEqual(keys)
    // The break marker flags the sentence it follows (s2), no one else.
    expect(order.get('s1')!.ends_paragraph).toBeNull()
    expect(order.get('s2')!.ends_paragraph).toBe(1)
    expect(order.get('s3')!.ends_paragraph).toBeNull()
  })

  test('accepts a stringified JSON array and ignores texts with no sentences', () => {
    const order = build_sentence_order([
      { id: 't1', sentences: JSON.stringify(['a', 'b']) },
      { id: 't2', sentences: null },
      { id: 't3', sentences: [] },
    ])
    expect([...order.keys()]).toEqual(['a', 'b'])
    expect(order.get('a')!.sort_key < order.get('b')!.sort_key).toBe(true)
  })
})
