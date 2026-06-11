import type Database from 'better-sqlite3'
import type { DictWriteConnection } from './dict-writes'
import { open_dictionary_db_in_memory } from '$lib/db/server/dictionary-db'
import {
  dispatch_dict_write,
  insert_audio_local,
  insert_entry_local,
  insert_rows_local,
  insert_sentence_local,
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
})
