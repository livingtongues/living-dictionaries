import type Database from 'better-sqlite3'
import type { DictChangesRequest } from './dictionary-sync-helpers'
import SqliteDatabase from 'better-sqlite3'
import { open_dictionary_db_in_memory } from './dictionary-db'
import { open_dictionary_history_db_in_memory } from './dictionary-history-db'
import { build_delta, build_snapshot, resolve_owners } from './dictionary-history-capture'
import { query_history } from './dictionary-history-query'
import { process_dict_changes } from './dictionary-sync-helpers'

// ── helpers ──────────────────────────────────────────────────────────────────

/** Raw insert with the NOT NULL audit columns auto-filled. */
function insert(db: Database.Database, table: string, row: Record<string, unknown>) {
  const full = { created_by_user_id: 'u1', updated_by_user_id: 'u1', ...row }
  const cols = Object.keys(full)
  db.prepare(
    `INSERT INTO "${table}" (${cols.map(c => `"${c}"`).join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
  ).run(...cols.map(c => full[c]))
  return row
}

describe('build_snapshot', () => {
  test('strips nulls + noise columns, keeps MultiString as nested object', () => {
    const snap = build_snapshot('entries', {
      id: 'e1',
      lexeme: { en: 'hello' }, // already an object (client push shape)
      phonetic: null,
      notes: null,
      dirty: 1,
      created_by_user_id: 'u1',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_by_user_id: 'u2',
      updated_at: '2026-01-02T00:00:00.000Z',
    })
    expect(snap).toEqual({
      id: 'e1',
      lexeme: { en: 'hello' },
      created_by_user_id: 'u1',
      created_at: '2026-01-01T00:00:00.000Z',
    })
    expect(snap).not.toHaveProperty('dirty')
    expect(snap).not.toHaveProperty('updated_at')
    expect(snap).not.toHaveProperty('updated_by_user_id')
    expect(snap).not.toHaveProperty('phonetic')
  })

  test('parses JSON-string columns coming straight from the DB', () => {
    const snap = build_snapshot('entries', { id: 'e1', lexeme: '{"en":"hi"}' })
    expect(snap.lexeme).toEqual({ en: 'hi' })
  })
})

describe('build_delta', () => {
  test('insert (no existing) → null', () => {
    expect(build_delta('entries', null, { id: 'e1', lexeme: { en: 'hi' } })).toBeNull()
  })

  test('update → only changed content columns, noise excluded', () => {
    const existing = { id: 'e1', lexeme: '{"en":"hi"}', phonetic: 'hɪ', updated_at: 'A', updated_by_user_id: 'u1', dirty: null }
    const incoming = { id: 'e1', lexeme: { en: 'hi' }, phonetic: 'haɪ', updated_at: 'B', updated_by_user_id: 'u2', dirty: 1 }
    const delta = build_delta('entries', existing, incoming)
    expect(delta).toEqual({ phonetic: { old: 'hɪ', new: 'haɪ' } })
  })

  test('updated_at-only re-push → empty diff → null (no phantom history)', () => {
    const existing = { id: 'e1', lexeme: '{"en":"hi"}', updated_at: 'A', dirty: null }
    const incoming = { id: 'e1', lexeme: { en: 'hi' }, updated_at: 'B', dirty: 1 }
    expect(build_delta('entries', existing, incoming)).toBeNull()
  })

  test('MultiString diff is order-insensitive on keys', () => {
    const existing = { id: 'e1', lexeme: '{"en":"hi","es":"hola"}' }
    const incoming = { id: 'e1', lexeme: { es: 'hola', en: 'hi' } }
    expect(build_delta('entries', existing, incoming)).toBeNull()
  })
})

describe('resolve_owners — the entry≠text boundary + the prince matrix', () => {
  let db: Database.Database
  beforeEach(() => { db = open_dictionary_db_in_memory('t') })
  afterEach(() => db.close())

  test('entries → entry only (NEVER text)', () => {
    const owners = resolve_owners(db, 'entries', { id: 'e1', lexeme: '{"en":"x"}' })
    expect(owners).toEqual([{ type: 'entry', id: 'e1' }])
    expect(owners.some(o => o.type === 'text')).toBeFalsy()
  })

  test('senses → owning entry only (NEVER text)', () => {
    const owners = resolve_owners(db, 'senses', { id: 's1', entry_id: 'e9' })
    expect(owners).toEqual([{ type: 'entry', id: 'e9' }])
  })

  test('texts → text', () => {
    expect(resolve_owners(db, 'texts', { id: 't1' })).toEqual([{ type: 'text', id: 't1' }])
  })

  test('standalone example sentence → sentence only', () => {
    insert(db, 'entries', { id: 'e1', lexeme: '{"en":"x"}' })
    insert(db, 'sentences', { id: 'snt1' })
    expect(resolve_owners(db, 'sentences', { id: 'snt1', text_id: null })).toEqual([{ type: 'sentence', id: 'snt1' }])
  })

  test('sentence that is BOTH in a text AND linked to a sense → sentence + text + entry', () => {
    insert(db, 'entries', { id: 'e1', lexeme: '{"en":"x"}' })
    insert(db, 'senses', { id: 's1', entry_id: 'e1' })
    insert(db, 'texts', { id: 't1', title: '{"en":"story"}' })
    insert(db, 'sentences', { id: 'snt1', text_id: 't1' })
    insert(db, 'senses_in_sentences', { id: 'j1', sense_id: 's1', sentence_id: 'snt1' })
    const owners = resolve_owners(db, 'sentences', { id: 'snt1', text_id: 't1' })
    expect(owners).toEqual(expect.arrayContaining([
      { type: 'sentence', id: 'snt1' },
      { type: 'text', id: 't1' },
      { type: 'entry', id: 'e1' },
    ]))
    expect(owners).toHaveLength(3)
  })

  test('senses_in_sentences junction → sentence + entry', () => {
    insert(db, 'entries', { id: 'e2', lexeme: '{"en":"x"}' })
    insert(db, 'senses', { id: 's2', entry_id: 'e2' })
    insert(db, 'sentences', { id: 'snt2' })
    const owners = resolve_owners(db, 'senses_in_sentences', { id: 'j2', sense_id: 's2', sentence_id: 'snt2' })
    expect(owners).toEqual(expect.arrayContaining([
      { type: 'sentence', id: 'snt2' },
      { type: 'entry', id: 'e2' },
    ]))
    expect(owners).toHaveLength(2)
  })

  test('audio on an entry → entry; entry_tags/entry_dialects → entry', () => {
    expect(resolve_owners(db, 'audio', { id: 'a1', entry_id: 'e3', storage_path: 'p' })).toEqual([{ type: 'entry', id: 'e3' }])
    expect(resolve_owners(db, 'entry_tags', { id: 'et1', entry_id: 'e3', tag_id: 'tg1' })).toEqual([{ type: 'entry', id: 'e3' }])
    expect(resolve_owners(db, 'entry_dialects', { id: 'ed1', entry_id: 'e3', dialect_id: 'd1' })).toEqual([{ type: 'entry', id: 'e3' }])
  })

  test('audio_speakers → the parent audio owners', () => {
    insert(db, 'entries', { id: 'e4', lexeme: '{"en":"x"}' })
    insert(db, 'audio', { id: 'a4', entry_id: 'e4', storage_path: 'p' })
    insert(db, 'speakers', { id: 'sp4', name: 'Bob' })
    expect(resolve_owners(db, 'audio_speakers', { id: 'as4', audio_id: 'a4', speaker_id: 'sp4' }))
      .toEqual([{ type: 'entry', id: 'e4' }])
  })

  test('sense_photos / sense_videos → owning entry', () => {
    insert(db, 'entries', { id: 'e5', lexeme: '{"en":"x"}' })
    insert(db, 'senses', { id: 's5', entry_id: 'e5' })
    expect(resolve_owners(db, 'sense_photos', { id: 'sp', sense_id: 's5', photo_id: 'p5' })).toEqual([{ type: 'entry', id: 'e5' }])
    expect(resolve_owners(db, 'sense_videos', { id: 'sv', sense_id: 's5', video_id: 'v5' })).toEqual([{ type: 'entry', id: 'e5' }])
  })

  test('shared-entity rows (speakers/tags/dialects/photos) → NO owners (no fan-out)', () => {
    expect(resolve_owners(db, 'speakers', { id: 'sp1', name: 'Ann' })).toEqual([])
    expect(resolve_owners(db, 'tags', { id: 'tg1', name: 'verb' })).toEqual([])
    expect(resolve_owners(db, 'dialects', { id: 'd1', name: 'north' })).toEqual([])
    expect(resolve_owners(db, 'photos', { id: 'p1', storage_path: 'x', serving_url: 'y' })).toEqual([])
  })
})

// ── Layer 2: capture through the real merge chokepoint ───────────────────────

function entry_dirty(id: string, at: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    lexeme: { en: 'hello' },
    phonetic: null,
    interlinearization: null,
    morphology: null,
    notes: null,
    sources: null,
    scientific_names: null,
    coordinates: null,
    unsupported_fields: null,
    elicitation_id: null,
    dirty: 1,
    created_by_user_id: 'u1',
    created_at: at,
    updated_by_user_id: 'u1',
    updated_at: at,
    ...over,
  }
}

function push(db: Database.Database, hdb: Database.Database, request: Partial<DictChangesRequest>, opts: { user_id?: string, is_editor?: boolean } = {}) {
  return process_dict_changes({
    db,
    history_db: hdb,
    user_id: opts.user_id ?? 'u1',
    is_editor: opts.is_editor ?? true,
    request: {
      synced_up_to: null,
      dirty_rows: {},
      deletes: [],
      latest_dict_migration: '20260606_initial.sql',
      ...request,
    },
  })
}

function changes(hdb: Database.Database) {
  // Order by rowid (insertion order) — deterministic even when two batches
  // land in the same millisecond and thus share `at`.
  return hdb.prepare('SELECT * FROM changes ORDER BY rowid ASC').all() as Record<string, unknown>[]
}
function owners_of(hdb: Database.Database, change_id: string) {
  return (hdb.prepare('SELECT owner_type, owner_id FROM change_owners WHERE change_id = ?').all(change_id) as { owner_type: string, owner_id: string }[])
    .map(o => ({ type: o.owner_type, id: o.owner_id }))
}

describe('history capture through process_dict_changes', () => {
  let db: Database.Database
  let hdb: Database.Database
  beforeEach(() => { db = open_dictionary_db_in_memory('t'); hdb = open_dictionary_history_db_in_memory() })
  afterEach(() => { db.close(); hdb.close() })

  test('insert entry → one insert change + entry owner; snapshot round-trips; delta null', () => {
    push(db, hdb, { dirty_rows: { entries: [entry_dirty('e1', '2026-01-01T00:00:00.000Z')] } })
    const rows = changes(hdb)
    expect(rows).toHaveLength(1)
    expect(rows[0].op).toBe('insert')
    expect(rows[0].table_name).toBe('entries')
    expect(rows[0].row_id).toBe('e1')
    expect(rows[0].user_id).toBe('u1')
    expect(rows[0].delta).toBeNull()
    expect(JSON.parse(rows[0].snapshot as string).lexeme).toEqual({ en: 'hello' })
    expect(owners_of(hdb, rows[0].id as string)).toEqual([{ type: 'entry', id: 'e1' }])
  })

  test('update entry phonetic → update change with only that column in delta', () => {
    push(db, hdb, { dirty_rows: { entries: [entry_dirty('e1', '2026-01-01T00:00:00.000Z')] } })
    push(db, hdb, { dirty_rows: { entries: [entry_dirty('e1', '2026-01-02T00:00:00.000Z', { phonetic: 'həˈloʊ' })] } })
    const rows = changes(hdb)
    expect(rows).toHaveLength(2)
    expect(rows[1].op).toBe('update')
    expect(JSON.parse(rows[1].delta as string)).toEqual({ phonetic: { old: null, new: 'həˈloʊ' } })
  })

  test('LWW server-wins (older updated_at) → no history row', () => {
    push(db, hdb, { dirty_rows: { entries: [entry_dirty('e1', '2026-02-01T00:00:00.000Z')] } })
    push(db, hdb, { dirty_rows: { entries: [entry_dirty('e1', '2026-01-01T00:00:00.000Z', { phonetic: 'stale' })] } })
    expect(changes(hdb)).toHaveLength(1)
  })

  test('updated_at-only re-push (no content change) → no history row', () => {
    push(db, hdb, { dirty_rows: { entries: [entry_dirty('e1', '2026-01-01T00:00:00.000Z')] } })
    push(db, hdb, { dirty_rows: { entries: [entry_dirty('e1', '2026-01-02T00:00:00.000Z')] } })
    expect(changes(hdb)).toHaveLength(1)
  })

  test('delete → delete change with pre-delete image + resolved owner', () => {
    push(db, hdb, { dirty_rows: { entries: [entry_dirty('e1', '2026-01-01T00:00:00.000Z')] } })
    push(db, hdb, { deletes: [{ table_name: 'entries', id: 'e1' }] })
    const rows = changes(hdb)
    expect(rows).toHaveLength(2)
    expect(rows[1].op).toBe('delete')
    expect(rows[1].delta).toBeNull()
    expect(JSON.parse(rows[1].snapshot as string).lexeme).toEqual({ en: 'hello' })
    expect(owners_of(hdb, rows[1].id as string)).toEqual([{ type: 'entry', id: 'e1' }])
    // The actual row is gone from the main db.
    expect(db.prepare('SELECT 1 FROM entries WHERE id = ?').get('e1')).toBeUndefined()
  })

  test('multi-row batch shares one `at`', () => {
    push(db, hdb, {
      dirty_rows: {
        entries: [entry_dirty('e1', '2026-01-01T00:00:00.000Z')],
        senses: [{ id: 's1', entry_id: 'e1', definition: null, glosses: { en: 'a greeting' }, parts_of_speech: null, semantic_domains: null, write_in_semantic_domains: null, noun_class: null, plural_form: null, variant: null, dirty: 1, created_by_user_id: 'u1', created_at: '2026-01-01T00:00:00.000Z', updated_by_user_id: 'u1', updated_at: '2026-01-01T00:00:00.000Z' }],
      },
    })
    const rows = changes(hdb)
    expect(rows).toHaveLength(2)
    expect(new Set(rows.map(r => r.at)).size).toBe(1)
    const sense = rows.find(r => r.table_name === 'senses')!
    expect(owners_of(hdb, sense.id as string)).toEqual([{ type: 'entry', id: 'e1' }])
  })

  test('sentence in a text AND linked to a sense → text + entry + sentence owners (after the link exists)', () => {
    const at1 = '2026-01-01T00:00:00.000Z'
    push(db, hdb, {
      dirty_rows: {
        entries: [entry_dirty('e1', at1)],
        texts: [{ id: 'tx1', title: { en: 'Story' }, dirty: 1, created_by_user_id: 'u1', created_at: at1, updated_by_user_id: 'u1', updated_at: at1 }],
        senses: [{ id: 's1', entry_id: 'e1', definition: null, glosses: { en: 'g' }, parts_of_speech: null, semantic_domains: null, write_in_semantic_domains: null, noun_class: null, plural_form: null, variant: null, dirty: 1, created_by_user_id: 'u1', created_at: at1, updated_by_user_id: 'u1', updated_at: at1 }],
        sentences: [{ id: 'snt1', text: { en: 'A line.' }, translation: null, text_id: 'tx1', sort_key: 'a', ends_paragraph: null, dirty: 1, created_by_user_id: 'u1', created_at: at1, updated_by_user_id: 'u1', updated_at: at1 }],
        senses_in_sentences: [{ id: 'j1', sense_id: 's1', sentence_id: 'snt1', dirty: 1, created_by_user_id: 'u1', created_at: at1, updated_by_user_id: 'u1', updated_at: at1 }],
      },
    })
    // Now the junction exists; editing the sentence resolves the full overlap.
    push(db, hdb, { dirty_rows: { sentences: [{ id: 'snt1', text: { en: 'A new line.' }, translation: null, text_id: 'tx1', sort_key: 'a', ends_paragraph: null, dirty: 1, created_by_user_id: 'u1', created_at: at1, updated_by_user_id: 'u1', updated_at: '2026-01-05T00:00:00.000Z' }] } })
    const update = changes(hdb).find(r => r.table_name === 'sentences' && r.op === 'update')!
    expect(owners_of(hdb, update.id as string)).toEqual(expect.arrayContaining([
      { type: 'sentence', id: 'snt1' },
      { type: 'text', id: 'tx1' },
      { type: 'entry', id: 'e1' },
    ]))
    expect(owners_of(hdb, update.id as string)).toHaveLength(3)
  })

  test('viewer push (is_editor=false) → nothing written, no history', () => {
    push(db, hdb, { dirty_rows: { entries: [entry_dirty('e1', '2026-01-01T00:00:00.000Z')] } }, { is_editor: false })
    expect(changes(hdb)).toHaveLength(0)
    expect(db.prepare('SELECT 1 FROM entries WHERE id = ?').get('e1')).toBeUndefined()
  })

  test('speaker insert → recorded in changes but with ZERO owners (no fan-out)', () => {
    push(db, hdb, { dirty_rows: { speakers: [{ id: 'sp1', name: 'Ann', decade: null, gender: null, birthplace: null, user_id: null, dirty: 1, created_by_user_id: 'u1', created_at: '2026-01-01T00:00:00.000Z', updated_by_user_id: 'u1', updated_at: '2026-01-01T00:00:00.000Z' }] } })
    const rows = changes(hdb)
    expect(rows).toHaveLength(1)
    expect(rows[0].table_name).toBe('speakers')
    expect(owners_of(hdb, rows[0].id as string)).toEqual([])
  })
})

// ── Layer 2b: the read query (query_history) ─────────────────────────────────

function make_shared_users(rows: { id: string, name: string | null, email: string | null }[]) {
  const sdb = new SqliteDatabase(':memory:')
  sdb.exec('CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, email TEXT)')
  const stmt = sdb.prepare('INSERT INTO users (id, name, email) VALUES (?, ?, ?)')
  for (const r of rows) stmt.run(r.id, r.name, r.email)
  return sdb
}

describe('query_history (read side)', () => {
  let db: Database.Database
  let hdb: Database.Database
  let sdb: Database.Database
  beforeEach(() => {
    db = open_dictionary_db_in_memory('t')
    hdb = open_dictionary_history_db_in_memory()
    sdb = make_shared_users([{ id: 'u1', name: 'Ada', email: 'ada@x.org' }])
    // entry insert, then an edit, then an unrelated speaker insert.
    push(db, hdb, { dirty_rows: { entries: [entry_dirty('e1', '2026-01-01T00:00:00.000Z')] } })
    push(db, hdb, { dirty_rows: { entries: [entry_dirty('e1', '2026-01-02T00:00:00.000Z', { phonetic: 'p' })] } })
    push(db, hdb, { dirty_rows: { speakers: [{ id: 'sp1', name: 'Bo', decade: null, gender: null, birthplace: null, user_id: null, dirty: 1, created_by_user_id: 'u1', created_at: '2026-01-03T00:00:00.000Z', updated_by_user_id: 'u1', updated_at: '2026-01-03T00:00:00.000Z' }] } })
  })
  afterEach(() => { db.close(); hdb.close(); sdb.close() })

  test('entry timeline → newest first, parsed payloads, resolved user name', () => {
    const res = query_history(hdb, sdb, { owner_type: 'entry', owner_id: 'e1' })
    expect(res.changes.map(c => c.op)).toEqual(['update', 'insert']) // DESC
    expect(res.changes[0].delta).toEqual({ phonetic: { old: null, new: 'p' } })
    expect(res.changes[1].snapshot!.lexeme).toEqual({ en: 'hello' })
    expect(res.users.u1).toEqual({ id: 'u1', name: 'Ada', email: 'ada@x.org' })
    // the speaker change is NOT attributed to the entry
    expect(res.changes.every(c => c.table_name === 'entries')).toBeTruthy()
  })

  test('feed → every change incl. the unattributed speaker', () => {
    const res = query_history(hdb, sdb, { feed: true })
    expect(res.changes).toHaveLength(3)
    expect(res.changes.some(c => c.table_name === 'speakers')).toBeTruthy()
  })

  test('keyset pagination via cursor', () => {
    const page1 = query_history(hdb, sdb, { owner_type: 'entry', owner_id: 'e1', limit: 1 })
    expect(page1.changes).toHaveLength(1)
    expect(page1.changes[0].op).toBe('update')
    expect(page1.cursor).not.toBeNull()
    const page2 = query_history(hdb, sdb, { owner_type: 'entry', owner_id: 'e1', limit: 1, before: page1.cursor! })
    expect(page2.changes).toHaveLength(1)
    expect(page2.changes[0].op).toBe('insert')
    expect(page2.cursor).toBeNull()
  })

  test('unknown owner → empty', () => {
    expect(query_history(hdb, sdb, { owner_type: 'entry', owner_id: 'nope' }).changes).toEqual([])
  })
})
