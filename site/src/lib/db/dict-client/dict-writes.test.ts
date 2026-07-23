import type Database from 'better-sqlite3'
import type { DictWriteConnection } from './dict-writes'
import { open_dictionary_db_in_memory } from '$lib/db/server/dictionary-db'
import {
  dispatch_dict_write,
  insert_audio_local,
  insert_entry_local,
  insert_rows_local,
  insert_sentence_local,
  insert_text_local,
  insert_video_local,
  link_junction_local,
  unlink_junction_local,
  upsert_rows_local,
} from './dict-writes'

let db: Database.Database
let connection: DictWriteConnection

/** Adapt a synchronous better-sqlite3 handle to the async worker-connection shape. */
function make_connection(handle: Database.Database): DictWriteConnection {
  return {
    query: <T>(sql: string, params: unknown[] = []) => Promise.resolve(handle.prepare(sql).all(...params as never[]) as T[]),
    execute: (sql: string, params: unknown[] = []) => { handle.prepare(sql).run(...params as never[]); return Promise.resolve() },
  }
}

/** Mirror the `dict_write` handler in dict-instance.ts: BEGIN → dispatch → COMMIT/ROLLBACK. */
async function run_atomic(op: string, args: Record<string, unknown>) {
  await connection.execute('BEGIN')
  try {
    const outcome = await dispatch_dict_write({ op, connection, args })
    await connection.execute('COMMIT')
    return outcome
  } catch (err) {
    await connection.execute('ROLLBACK')
    throw err
  }
}

beforeEach(() => {
  db = open_dictionary_db_in_memory('test-dict')
  connection = make_connection(db)
})

afterEach(() => db.close())

function count(sql: string, ...params: unknown[]): number {
  return (db.prepare(sql).get(...params as never[]) as { c: number }).c
}

const user_id = 'editor-1'

async function seed_entry(): Promise<string> {
  const { result } = await run_atomic('insert_entry', { user_id, lexeme: { default: 'kya' } })
  return (result as { id: string }).id
}

async function seed_speaker(): Promise<string> {
  const { result } = await run_atomic('insert_rows', { user_id, table: 'speakers', rows: [{ name: 'Ada' }] })
  return (result as { id: string }[])[0].id
}

describe(insert_entry_local, () => {
  test('creates entry + first sense atomically with full stamping', async () => {
    const outcome = await run_atomic('insert_entry', { user_id, lexeme: { default: 'kya', es: 'qué' } })
    const entry = outcome.result as Record<string, unknown>

    expect(outcome.affected_tables).toEqual(['entries', 'senses'])
    // echo comes back parsed (JSON columns as objects)
    expect(entry.lexeme).toEqual({ default: 'kya', es: 'qué' })
    expect(entry.dirty).toBe(1)
    expect(entry.created_by_user_id).toBe(user_id)
    expect(entry.updated_by_user_id).toBe(user_id)
    expect(entry.created_at).toBe(entry.updated_at)
    // stored as JSON text in the DB
    const raw = db.prepare('SELECT lexeme FROM entries WHERE id = ?').get(entry.id) as { lexeme: string }
    expect(JSON.parse(raw.lexeme)).toEqual({ default: 'kya', es: 'qué' })
    expect(count('SELECT COUNT(*) c FROM senses WHERE entry_id = ? AND dirty = 1', entry.id)).toBe(1)
  })
})

describe(insert_sentence_local, () => {
  test('creates sentence + sense junction in one group', async () => {
    const entry_id = await seed_entry()
    const sense = db.prepare('SELECT id FROM senses WHERE entry_id = ?').get(entry_id) as { id: string }

    const outcome = await run_atomic('insert_sentence', { user_id, sentence: { text: { default: 'kya hal hai' } }, sense_id: sense.id })
    const sentence = outcome.result as Record<string, unknown>

    expect(sentence.text).toEqual({ default: 'kya hal hai' })
    expect(count('SELECT COUNT(*) c FROM senses_in_sentences WHERE sentence_id = ? AND sense_id = ?', sentence.id, sense.id)).toBe(1)
  })

  test('ROLLS BACK the whole group when a later statement fails (no orphan sentence)', async () => {
    await expect(
      run_atomic('insert_sentence', { user_id, sentence: { text: { default: 'orphan?' } }, sense_id: 'missing-sense' }),
    ).rejects.toThrow()
    expect(count('SELECT COUNT(*) c FROM sentences')).toBe(0)
    expect(count('SELECT COUNT(*) c FROM senses_in_sentences')).toBe(0)
  })
})

describe(insert_text_local, () => {
  test('creates text + ordered sentences with ascending sort_keys and paragraph flags', async () => {
    const outcome = await run_atomic('insert_text', {
      user_id,
      title: { default: 'The mountain story' },
      sentences: [
        { text: { default: 'One.' } },
        { text: { default: 'Two.' }, ends_paragraph: 1 },
        { text: { default: 'Three.' } },
      ],
    })
    const text = outcome.result as Record<string, unknown>

    expect(outcome.affected_tables).toEqual(['texts', 'sentences'])
    expect(text.title).toEqual({ default: 'The mountain story' })
    const rows = db.prepare('SELECT text, sort_key, ends_paragraph, dirty FROM sentences WHERE text_id = ? ORDER BY sort_key ASC').all(text.id) as { text: string, sort_key: string, ends_paragraph: number | null, dirty: number }[]
    expect(rows.map(row => JSON.parse(row.text).default)).toEqual(['One.', 'Two.', 'Three.'])
    expect(rows.map(row => row.ends_paragraph)).toEqual([null, 1, null])
    expect(rows.every(row => row.dirty === 1)).toBeTruthy()
    const keys = rows.map(row => row.sort_key)
    expect([...keys].sort()).toEqual(keys)
    expect(new Set(keys).size).toBe(3)
  })

  test('a text with no sentences affects only texts', async () => {
    const outcome = await run_atomic('insert_text', { user_id, title: { default: 'Empty' }, sentences: [] })
    expect(outcome.affected_tables).toEqual(['texts'])
  })

  test('re-sent insert_text (same client-stamped id) collides loudly, no duplicate', async () => {
    const args = { user_id, text_id: crypto.randomUUID(), title: { default: 'Once' }, sentences: [{ text: { default: 'A.' } }] }
    await run_atomic('insert_text', args)
    await expect(run_atomic('insert_text', args)).rejects.toThrow()
    expect(count('SELECT COUNT(*) c FROM texts')).toBe(1)
    expect(count('SELECT COUNT(*) c FROM sentences')).toBe(1)
  })
})

describe(insert_rows_local, () => {
  test('inserts multiple rows with generated ids in one transaction', async () => {
    const { result } = await run_atomic('insert_rows', {
      user_id,
      table: 'dialects',
      rows: [{ name: { default: 'Coastal' } }, { name: { default: 'Highland' } }],
    })
    const rows = result as Record<string, unknown>[]
    expect(rows).toHaveLength(2)
    expect(rows[0].id).toBeTruthy()
    expect(rows[0].name).toEqual({ default: 'Coastal' })
    expect(count('SELECT COUNT(*) c FROM dialects WHERE dirty = 1')).toBe(2)
  })

  test('rolls back ALL rows when one fails (no partial batch)', async () => {
    await expect(
      run_atomic('insert_rows', {
        user_id,
        table: 'tags',
        rows: [{ name: 'ok' }, { name: null }], // second row violates NOT NULL
      }),
    ).rejects.toThrow()
    expect(count('SELECT COUNT(*) c FROM tags')).toBe(0)
  })
})

describe(upsert_rows_local, () => {
  test('updates on id conflict and re-stamps dirty', async () => {
    const { result } = await run_atomic('insert_rows', { user_id, table: 'tags', rows: [{ name: 'draft' }] })
    const [tag] = result as { id: string }[]
    db.prepare('UPDATE tags SET dirty = NULL WHERE id = ?').run(tag.id)

    await run_atomic('upsert_rows', { user_id: 'editor-2', table: 'tags', rows: [{ id: tag.id, name: 'final', created_by_user_id: user_id, created_at: '2026-01-01T00:00:00.000Z' }] })

    const updated = db.prepare('SELECT name, dirty, updated_by_user_id FROM tags WHERE id = ?').get(tag.id) as Record<string, unknown>
    expect(updated.name).toBe('final')
    expect(updated.dirty).toBe(1)
    expect(updated.updated_by_user_id).toBe('editor-2')
    expect(count('SELECT COUNT(*) c FROM tags')).toBe(1)
  })
})

describe(insert_audio_local, () => {
  test('creates audio + speaker junction atomically when speaker_id given', async () => {
    const entry_id = await seed_entry()
    const speaker_id = await seed_speaker()

    const outcome = await run_atomic('insert_audio', { user_id, audio: { storage_path: 'a/b.mp3', entry_id }, speaker_id })
    const audio = outcome.result as { id: string }

    expect(outcome.affected_tables).toEqual(['audio', 'audio_speakers'])
    expect(count('SELECT COUNT(*) c FROM audio_speakers WHERE audio_id = ? AND speaker_id = ?', audio.id, speaker_id)).toBe(1)
  })

  test('rolls back the audio row when the speaker junction fails', async () => {
    const entry_id = await seed_entry()
    await expect(
      run_atomic('insert_audio', { user_id, audio: { storage_path: 'a/b.mp3', entry_id }, speaker_id: 'missing-speaker' }),
    ).rejects.toThrow()
    expect(count('SELECT COUNT(*) c FROM audio')).toBe(0)
  })

  test('skips the junction without speaker_id', async () => {
    const entry_id = await seed_entry()
    const outcome = await run_atomic('insert_audio', { user_id, audio: { storage_path: 'a/b.mp3', entry_id } })
    expect(outcome.affected_tables).toEqual(['audio'])
    expect(count('SELECT COUNT(*) c FROM audio_speakers')).toBe(0)
  })
})

describe(insert_video_local, () => {
  test('creates video + sense junction + speaker junction in one group', async () => {
    const entry_id = await seed_entry()
    const sense = db.prepare('SELECT id FROM senses WHERE entry_id = ?').get(entry_id) as { id: string }
    const speaker_id = await seed_speaker()

    const outcome = await run_atomic('insert_video', { user_id, video: { storage_path: 'v/c.mp4' }, sense_id: sense.id, speaker_id })
    const video = outcome.result as { id: string }

    expect(outcome.affected_tables).toEqual(['videos', 'sense_videos', 'video_speakers'])
    expect(count('SELECT COUNT(*) c FROM sense_videos WHERE video_id = ? AND sense_id = ?', video.id, sense.id)).toBe(1)
    expect(count('SELECT COUNT(*) c FROM video_speakers WHERE video_id = ? AND speaker_id = ?', video.id, speaker_id)).toBe(1)
  })
})

describe(link_junction_local, () => {
  test('creates the link once; second call is a no-op', async () => {
    const entry_id = await seed_entry()
    const { result: tag_rows } = await run_atomic('insert_rows', { user_id, table: 'tags', rows: [{ name: 'archaic' }] })
    const tag_id = (tag_rows as { id: string }[])[0].id

    const first = await run_atomic('link_junction', { user_id, table: 'entry_tags', key: { entry_id, tag_id } })
    const second = await run_atomic('link_junction', { user_id, table: 'entry_tags', key: { entry_id, tag_id } })

    expect(first.result).toEqual({ linked: true })
    expect(second.result).toEqual({ linked: false })
    expect(count('SELECT COUNT(*) c FROM entry_tags WHERE entry_id = ? AND tag_id = ?', entry_id, tag_id)).toBe(1)
  })

  test('rejects non-junction tables', async () => {
    await expect(
      run_atomic('link_junction', { user_id, table: 'entries', key: { id: 'x' } }),
    ).rejects.toThrow('not a junction table')
  })
})

describe(unlink_junction_local, () => {
  test('tombstones the link (trigger hard-deletes the row); second call is a no-op', async () => {
    const entry_id = await seed_entry()
    const { result: tag_rows } = await run_atomic('insert_rows', { user_id, table: 'tags', rows: [{ name: 'archaic' }] })
    const tag_id = (tag_rows as { id: string }[])[0].id
    await run_atomic('link_junction', { user_id, table: 'entry_tags', key: { entry_id, tag_id } })
    const junction = db.prepare('SELECT id FROM entry_tags WHERE entry_id = ? AND tag_id = ?').get(entry_id, tag_id) as { id: string }

    const first = await run_atomic('unlink_junction', { table: 'entry_tags', key: { entry_id, tag_id } })
    const second = await run_atomic('unlink_junction', { table: 'entry_tags', key: { entry_id, tag_id } })

    expect(first.result).toEqual({ unlinked: true })
    expect(first.deleted_rows).toEqual([{ table_name: 'entry_tags', id: junction.id }])
    expect(second.result).toEqual({ unlinked: false })
    // process_delete_cascade hard-deleted the junction row; the tombstone remains
    expect(count('SELECT COUNT(*) c FROM entry_tags')).toBe(0)
    expect(count('SELECT COUNT(*) c FROM deletes WHERE table_name = ? AND id = ?', 'entry_tags', junction.id)).toBe(1)
  })
})

describe(dispatch_dict_write, () => {
  test('throws a coded error for an unknown op', async () => {
    await expect(run_atomic('explode', {})).rejects.toThrow('unknown dict_write op explode')
  })

  // The at-least-once hand-off edge: an op the old leader applied (then died
  // before responding) gets re-sent to the new leader. Client-stamped ids make
  // the re-application collide on the PK and roll back the WHOLE group loudly —
  // no silent duplicate (the facade always stamps; these mirror its payloads).
  test('re-sent insert_entry (same client-stamped id) collides loudly, no duplicate', async () => {
    const args = { user_id, lexeme: { default: 'dup' }, entry_id: crypto.randomUUID() }
    await run_atomic('insert_entry', args)
    await expect(run_atomic('insert_entry', args)).rejects.toThrow()
    expect(count('SELECT COUNT(*) c FROM entries')).toBe(1)
    expect(count('SELECT COUNT(*) c FROM senses')).toBe(1)
  })

  test('re-sent insert_photo (same client-stamped id) collides loudly, no duplicate', async () => {
    const entry_id = await seed_entry()
    const sense = db.prepare('SELECT id FROM senses WHERE entry_id = ?').get(entry_id) as { id: string }
    const args = { user_id, photo: { id: crypto.randomUUID(), storage_path: 'p/a.jpg', serving_url: 'https://img' }, sense_id: sense.id }
    await run_atomic('insert_photo', args)
    await expect(run_atomic('insert_photo', args)).rejects.toThrow()
    expect(count('SELECT COUNT(*) c FROM photos')).toBe(1)
    expect(count('SELECT COUNT(*) c FROM sense_photos')).toBe(1)
  })

  test('re-sent insert_rows (same client-stamped ids) collides loudly, no duplicates', async () => {
    const args = { user_id, table: 'tags', rows: [{ id: crypto.randomUUID(), name: 'a' }, { id: crypto.randomUUID(), name: 'b' }] }
    await run_atomic('insert_rows', args)
    await expect(run_atomic('insert_rows', args)).rejects.toThrow()
    expect(count('SELECT COUNT(*) c FROM tags')).toBe(2)
  })
})

// ─── M3 word→entry matching ops (.issues/texts-sentences-pipeline.md) ────────

async function seed_matchable_entries() {
  await run_atomic('insert_entry', { user_id, lexeme: { default: 'nak' } })
  await run_atomic('insert_entry', { user_id, lexeme: { default: 'toré' } })
}

async function seed_text(sentences: { text: Record<string, string> }[]): Promise<{ text_id: string, sentence_ids: string[] }> {
  const { result } = await run_atomic('insert_text', { user_id, title: { default: 'Story' }, sentences })
  const text_id = (result as { id: string }).id
  const rows = db.prepare('SELECT id FROM sentences WHERE text_id = ? ORDER BY sort_key').all(text_id) as { id: string }[]
  return { text_id, sentence_ids: rows.map(row => row.id) }
}

function stored_tokens(sentence_id: string): Record<string, Record<string, unknown>[]> {
  const raw = db.prepare('SELECT tokens FROM sentences WHERE id = ?').get(sentence_id) as { tokens: string | null }
  return raw.tokens ? JSON.parse(raw.tokens) : null
}

function entry_id_for(lexeme_default: string): string {
  const rows = db.prepare('SELECT id, lexeme FROM entries').all() as { id: string, lexeme: string }[]
  return rows.find(row => JSON.parse(row.lexeme).default === lexeme_default).id
}

describe('insert_text auto-matching', () => {
  test('sentences arrive tokenized with auto matches and ignored punctuation', async () => {
    await seed_matchable_entries()
    const { sentence_ids } = await seed_text([{ text: { default: 'Nak toré, kaq!' } }])
    const tokens = stored_tokens(sentence_ids[0]).default
    expect(tokens).toEqual([
      { form: 'Nak', start: 0, end: 3, entry_id: entry_id_for('nak'), status: 'auto' },
      { form: 'toré', start: 4, end: 8, entry_id: entry_id_for('toré'), status: 'auto' },
      { form: ',', start: 8, end: 9, status: 'ignored' },
      { form: 'kaq', start: 10, end: 13 },
      { form: '!', start: 13, end: 14, status: 'ignored' },
    ])
  })
})

describe('set_token_link', () => {
  test('confirm writes status + sense link and mirrors the junction; unlink cleans it', async () => {
    await seed_matchable_entries()
    const { sentence_ids } = await seed_text([{ text: { default: 'Nak kaq' } }])
    const [sentence_id] = sentence_ids
    const nak_id = entry_id_for('nak')
    const sense = db.prepare('SELECT id FROM senses WHERE entry_id = ?').get(nak_id) as { id: string }

    const confirm = await run_atomic('set_token_link', {
      user_id, sentence_id, orthography: 'default', token_index: 0,
      action: 'confirm', entry_id: nak_id, sense_id: sense.id,
    })
    expect(confirm.affected_tables).toEqual(['sentences', 'senses_in_sentences'])
    expect(stored_tokens(sentence_id).default[0]).toEqual({
      form: 'Nak', start: 0, end: 3, entry_id: nak_id, sense_id: sense.id, status: 'confirmed',
    })
    expect(count('SELECT COUNT(*) c FROM senses_in_sentences WHERE sentence_id = ? AND sense_id = ?', sentence_id, sense.id)).toBe(1)

    // re-confirm is idempotent on the junction
    await run_atomic('set_token_link', {
      user_id, sentence_id, orthography: 'default', token_index: 0,
      action: 'confirm', entry_id: nak_id, sense_id: sense.id,
    })
    expect(count('SELECT COUNT(*) c FROM senses_in_sentences WHERE sentence_id = ?', sentence_id)).toBe(1)

    const unlink = await run_atomic('set_token_link', {
      user_id, sentence_id, orthography: 'default', token_index: 0, action: 'unlink',
    })
    expect(unlink.deleted_rows).toHaveLength(1)
    expect(stored_tokens(sentence_id).default[0]).toEqual({ form: 'Nak', start: 0, end: 3 })
    expect(count('SELECT COUNT(*) c FROM senses_in_sentences WHERE sentence_id = ?', sentence_id)).toBe(0)
  })

  test('ignore keeps gold gloss but drops the link', async () => {
    await seed_matchable_entries()
    const { sentence_ids } = await seed_text([{ text: { default: 'Nak' } }])
    const [sentence_id] = sentence_ids
    // hand the token a gloss as if agent-written
    const tokens = stored_tokens(sentence_id)
    tokens.default[0].gloss = { en: 'water' }
    db.prepare('UPDATE sentences SET tokens = ? WHERE id = ?').run(JSON.stringify(tokens), sentence_id)

    await run_atomic('set_token_link', { user_id, sentence_id, orthography: 'default', token_index: 0, action: 'ignore' })
    expect(stored_tokens(sentence_id).default[0]).toEqual({
      form: 'Nak', start: 0, end: 3, gloss: { en: 'water' }, status: 'ignored',
    })
  })
})

describe('update_sentence re-tokenization', () => {
  test('text edit preserves a confirmed link and cleans the junction of a vanished word', async () => {
    await seed_matchable_entries()
    const { sentence_ids } = await seed_text([{ text: { default: 'Nak toré' } }])
    const [sentence_id] = sentence_ids
    const nak_id = entry_id_for('nak')
    const tore_id = entry_id_for('toré')
    const nak_sense = (db.prepare('SELECT id FROM senses WHERE entry_id = ?').get(nak_id) as { id: string }).id
    const tore_sense = (db.prepare('SELECT id FROM senses WHERE entry_id = ?').get(tore_id) as { id: string }).id
    await run_atomic('set_token_link', { user_id, sentence_id, orthography: 'default', token_index: 0, action: 'confirm', entry_id: nak_id, sense_id: nak_sense })
    await run_atomic('set_token_link', { user_id, sentence_id, orthography: 'default', token_index: 1, action: 'confirm', entry_id: tore_id, sense_id: tore_sense })

    // drop "toré", keep "Nak", add a new word
    const outcome = await run_atomic('update_sentence', {
      user_id, sentence: { id: sentence_id, text: { default: 'Nak wia' } },
    })
    expect((outcome.result as { text: Record<string, string> }).text).toEqual({ default: 'Nak wia' })
    expect(stored_tokens(sentence_id).default).toEqual([
      { form: 'Nak', start: 0, end: 3, entry_id: nak_id, sense_id: nak_sense, status: 'confirmed' },
      { form: 'wia', start: 4, end: 7 },
    ])
    expect(count('SELECT COUNT(*) c FROM senses_in_sentences WHERE sentence_id = ? AND sense_id = ?', sentence_id, nak_sense)).toBe(1)
    expect(count('SELECT COUNT(*) c FROM senses_in_sentences WHERE sentence_id = ? AND sense_id = ?', sentence_id, tore_sense)).toBe(0)
  })

  test('translation-only patch does not touch tokens', async () => {
    await seed_matchable_entries()
    const { sentence_ids } = await seed_text([{ text: { default: 'Nak' } }])
    const before = stored_tokens(sentence_ids[0])
    await run_atomic('update_sentence', { user_id, sentence: { id: sentence_ids[0], translation: { en: 'Water' } } })
    expect(stored_tokens(sentence_ids[0])).toEqual(before)
  })
})

describe('analyze_sentences', () => {
  test('fills gaps after a new entry appears; gold tokens survive byte-identically; idempotent', async () => {
    const { text_id, sentence_ids } = await seed_text([{ text: { default: 'Nak kaq' } }])
    const [sentence_id] = sentence_ids
    // no entries yet — both words unmatched; simulate gold IGT on token 1
    const tokens = stored_tokens(sentence_id)
    tokens.default[1] = { ...tokens.default[1], gloss: { default: '3PL' }, status: 'confirmed' }
    db.prepare('UPDATE sentences SET tokens = ?, dirty = 0 WHERE id = ?').run(JSON.stringify(tokens), sentence_id)

    await run_atomic('insert_entry', { user_id, lexeme: { default: 'nak' } })
    const first = await run_atomic('analyze_sentences', { user_id, text_id })
    expect(first.result).toEqual({ analyzed: 1, changed: 1 })
    expect(stored_tokens(sentence_id).default).toEqual([
      { form: 'Nak', start: 0, end: 3, entry_id: entry_id_for('nak'), status: 'auto' },
      { form: 'kaq', start: 4, end: 7, gloss: { default: '3PL' }, status: 'confirmed' },
    ])

    // second run: nothing changes, no dirty churn
    db.prepare('UPDATE sentences SET dirty = 0 WHERE id = ?').run(sentence_id)
    const second = await run_atomic('analyze_sentences', { user_id, text_id })
    expect(second.result).toEqual({ analyzed: 1, changed: 0 })
    expect(count('SELECT COUNT(*) c FROM sentences WHERE id = ? AND dirty = 1', sentence_id)).toBe(0)
  })
})

describe('create_entry_from_token', () => {
  test('mints entry + sense and confirms the token in one transaction', async () => {
    const { sentence_ids } = await seed_text([{ text: { default: 'Zuq nak' } }])
    const [sentence_id] = sentence_ids
    const outcome = await run_atomic('create_entry_from_token', {
      user_id, lexeme: { default: 'Zuq' }, sentence_id, orthography: 'default', token_index: 0,
    })
    const entry = outcome.result as { id: string }
    expect(outcome.affected_tables).toEqual(['entries', 'senses', 'sentences', 'senses_in_sentences'])
    const sense = db.prepare('SELECT id FROM senses WHERE entry_id = ?').get(entry.id) as { id: string }
    expect(stored_tokens(sentence_id).default[0]).toEqual({
      form: 'Zuq', start: 0, end: 3, entry_id: entry.id, sense_id: sense.id, status: 'confirmed',
    })
    expect(count('SELECT COUNT(*) c FROM senses_in_sentences WHERE sentence_id = ? AND sense_id = ?', sentence_id, sense.id)).toBe(1)
  })
})

describe('ignore_form', () => {
  test('bulk-ignores non-confirmed occurrences (normalized) but never confirmed ones', async () => {
    await seed_matchable_entries()
    const { sentence_ids } = await seed_text([
      { text: { default: 'Nak kaq' } },
      { text: { default: 'KAQ toré' } },
      { text: { default: 'kaq!' } },
    ])
    // confirm the third occurrence so it must survive
    const nak_id = entry_id_for('nak')
    const sense = db.prepare('SELECT id FROM senses WHERE entry_id = ?').get(nak_id) as { id: string }
    await run_atomic('set_token_link', { user_id, sentence_id: sentence_ids[2], orthography: 'default', token_index: 0, action: 'confirm', entry_id: nak_id, sense_id: sense.id })

    const outcome = await run_atomic('ignore_form', { user_id, form: 'Kaq' })
    expect(outcome.result).toEqual({ sentences_changed: 2, occurrences: 2 })
    expect(stored_tokens(sentence_ids[0]).default[1].status).toBe('ignored')
    expect(stored_tokens(sentence_ids[1]).default[0].status).toBe('ignored')
    expect(stored_tokens(sentence_ids[2]).default[0].status).toBe('confirmed')

    // idempotent — already-ignored rows are skipped
    const again = await run_atomic('ignore_form', { user_id, form: 'kaq' })
    expect(again.result).toEqual({ sentences_changed: 0, occurrences: 0 })
  })
})

describe('insert_sentences', () => {
  test('bulk append arrives tokenized + matched', async () => {
    await seed_matchable_entries()
    const { text_id } = await seed_text([{ text: { default: 'Nak' } }])
    const outcome = await run_atomic('insert_sentences', {
      user_id,
      rows: [{ id: crypto.randomUUID(), text: { default: 'toré kaq' }, text_id, sort_key: 'zz' }],
    })
    const [row] = outcome.result as { id: string }[]
    expect(stored_tokens(row.id).default).toEqual([
      { form: 'toré', start: 0, end: 4, entry_id: entry_id_for('toré'), status: 'auto' },
      { form: 'kaq', start: 5, end: 8 },
    ])
  })
})
