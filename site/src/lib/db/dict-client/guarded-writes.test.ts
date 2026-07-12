import type Database from 'better-sqlite3'
import type { DictConnection } from './worker-connection'
import type { DictLiveDb } from './dict-live-db.svelte'
import { create_dict_live_db } from './dict-live-db.svelte'
import { create_guarded_writes } from './guarded-writes'
import { dispatch_dict_write } from './dict-writes'
import { open_dictionary_db_in_memory } from '$lib/db/server/dictionary-db'
import { log_warning } from '$lib/debug/remote-log'

vi.mock('$lib/debug/remote-log', async (importOriginal) => {
  const original = await importOriginal<typeof import('$lib/debug/remote-log')>()
  return { ...original, log_warning: vi.fn(), track: vi.fn() }
})

const user_id = 'editor-1'

/** Adapt a synchronous better-sqlite3 handle to the DictConnection shape,
 * running `dict_write` ops through the real dispatcher inside BEGIN/COMMIT
 * (mirrors the leader worker's `dict_write` handler). */
function make_dict_connection(handle: Database.Database): DictConnection {
  const base = {
    query: <T>(sql: string, params: unknown[] = []) => Promise.resolve(handle.prepare(sql).all(...params as never[]) as T[]),
    execute: (sql: string, params: unknown[] = []) => { handle.prepare(sql).run(...params as never[]); return Promise.resolve() },
  }
  return {
    dict_id: 'test-dict',
    is_opfs_backed: false,
    has_leader: () => true,
    query: base.query,
    execute: (sql, params = []) => base.execute(sql, params),
    dict_write: async (op, args) => {
      await base.execute('BEGIN')
      try {
        const outcome = await dispatch_dict_write({ op, connection: base, args })
        await base.execute('COMMIT')
        return outcome as never
      } catch (err) {
        await base.execute('ROLLBACK')
        throw err
      }
    },
    exec_raw: () => Promise.reject(new Error('n/a')),
    close: () => Promise.resolve(),
    delete_db: () => Promise.resolve(),
    subscribe_broadcasts: () => () => undefined,
    sync_now: () => Promise.resolve(),
  }
}

function make_harness() {
  const db = open_dictionary_db_in_memory('test-dict')
  const connection = make_dict_connection(db)
  const dict_db = create_dict_live_db(connection, { user_id })
  const on_error = vi.fn()
  const writes = create_guarded_writes({
    dict_db,
    connection,
    dictionary: { id: 'test-dict', url: 'test-dict' },
    get_user_id: () => user_id,
    is_loading: () => false,
    on_error,
  })
  const count = (sql: string, ...params: unknown[]) =>
    (db.prepare(sql).get(...params as never[]) as { c: number }).c
  return { db, dict_db, writes, on_error, count }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe(create_guarded_writes, () => {
  describe('readiness guard', () => {
    function blocked_deps(overrides: Partial<Parameters<typeof create_guarded_writes>[0]>) {
      const on_error = vi.fn()
      const writes = create_guarded_writes({
        dict_db: {} as DictLiveDb,
        connection: null,
        dictionary: { id: 'dict-1', url: 'dict-1' },
        get_user_id: () => user_id,
        is_loading: () => false,
        on_error,
        ...overrides,
      })
      return { writes, on_error }
    }

    test('not signed in → op resolves undefined, telemetry + on_error fire once', async () => {
      const { writes, on_error } = blocked_deps({ get_user_id: () => undefined })
      await expect(writes.insert_sense('e1')).resolves.toBe(undefined)
      expect(log_warning).toHaveBeenCalledExactlyOnceWith({
        message: 'write_blocked',
        context: { reason: 'not_signed_in', dictionary_id: 'dict-1', signed_in: false },
      })
      expect(on_error).toHaveBeenCalledExactlyOnceWith(new Error('You must be signed in to edit'))
    })

    test('dict_db missing → no_dict_db', async () => {
      const { writes, on_error } = blocked_deps({ dict_db: null })
      await expect(writes.delete_sense('s1')).resolves.toBe(undefined)
      expect(log_warning).toHaveBeenCalledExactlyOnceWith({
        message: 'write_blocked',
        context: { reason: 'no_dict_db', dictionary_id: 'dict-1', signed_in: true },
      })
      expect(on_error).toHaveBeenCalledExactlyOnceWith(new Error('Editing database is not ready yet'))
    })

    test('entries bundle still loading → still_loading', async () => {
      const { writes, on_error } = blocked_deps({ is_loading: () => true })
      await expect(writes.insert_tag({ name: 'x' })).resolves.toBe(undefined)
      expect(log_warning).toHaveBeenCalledExactlyOnceWith({
        message: 'write_blocked',
        context: { reason: 'still_loading', dictionary_id: 'dict-1', signed_in: true },
      })
      expect(on_error).toHaveBeenCalledExactlyOnceWith(new Error('Wait until loading spinner stops to make edits.'))
    })
  })

  test('op errors route to on_error exactly once and are swallowed', async () => {
    const on_error = vi.fn()
    const failing_db = { senses: { delete: () => Promise.reject(new Error('boom')) } } as unknown as DictLiveDb
    const writes = create_guarded_writes({
      dict_db: failing_db,
      connection: null,
      dictionary: { id: 'dict-1', url: 'dict-1' },
      get_user_id: () => user_id,
      is_loading: () => false,
      on_error,
    })
    await expect(writes.delete_sense('s1')).resolves.toBe(undefined)
    expect(on_error).toHaveBeenCalledExactlyOnceWith(new Error('boom'))
    expect(log_warning).not.toHaveBeenCalled()
  })

  test('insert_entry creates the entry and returns it (navigation is the caller concern)', async () => {
    const { writes, on_error, count, db } = make_harness()
    const entry = await writes.insert_entry({ default: 'kya' })
    expect(entry.lexeme).toEqual({ default: 'kya' })
    expect(count('SELECT COUNT(*) c FROM entries')).toBe(1)
    expect(on_error).not.toHaveBeenCalled()
    db.close()
  })

  test('insert_relationship dedupes the canonicalized pair (second insert is a no-op returning the existing row)', async () => {
    const { writes, on_error, count, db } = make_harness()
    const entry_a = await writes.insert_entry({ default: 'aaa' })
    const entry_b = await writes.insert_entry({ default: 'bbb' })

    const first = await writes.insert_relationship({ from_entry_id: entry_a.id, to_entry_id: entry_b.id, type: 'synonym' })
    expect(count('SELECT COUNT(*) c FROM entry_relationships')).toBe(1)

    // symmetric: the REVERSED pair canonicalizes to the same stored order
    const second = await writes.insert_relationship({ from_entry_id: entry_b.id, to_entry_id: entry_a.id, type: 'synonym' })
    expect(count('SELECT COUNT(*) c FROM entry_relationships')).toBe(1)
    expect(second.id).toBe(first.id)
    expect(on_error).not.toHaveBeenCalled()
    db.close()
  })

  test('remove_source_and_delete scrubs the slug from referencing rows before deleting the source', async () => {
    const { writes, dict_db, on_error, count, db } = make_harness()
    const source = await writes.insert_source({ slug: 'smith-2001', citation: 'Smith 2001' })
    const entry = await writes.insert_entry({ default: 'kya' })
    await dict_db.entries.update({ id: entry.id, sources: ['smith-2001', 'other-source'] })
    const audio = await writes.insert_audio({ storage_path: 'test/audio/a.webm', entry_id: entry.id, source: 'smith-2001' })

    await writes.remove_source_and_delete({ source_id: source.id, slug: 'smith-2001' })

    const entry_row = db.prepare('SELECT sources FROM entries WHERE id = ?').get(entry.id) as { sources: string }
    expect(JSON.parse(entry_row.sources)).toEqual(['other-source'])
    const audio_row = db.prepare('SELECT source FROM audio WHERE id = ?').get(audio.id) as { source: string | null }
    expect(audio_row.source).toBe(null)
    // the deletes tombstone's process_delete_cascade trigger hard-deleted the source row
    expect(count('SELECT COUNT(*) c FROM sources')).toBe(0)
    expect(on_error).not.toHaveBeenCalled()
    db.close()
  })

  test('junction assigns are idempotent and unassign removes the row', async () => {
    const { writes, on_error, count, db } = make_harness()
    const entry = await writes.insert_entry({ default: 'kya' })
    const tag = await writes.insert_tag({ name: 'plants' })

    await writes.assign_tag({ tag_id: tag.id, entry_id: entry.id })
    await writes.assign_tag({ tag_id: tag.id, entry_id: entry.id })
    expect(count('SELECT COUNT(*) c FROM entry_tags')).toBe(1)

    // unlink writes a `deletes` tombstone whose trigger hard-deletes the junction row
    await writes.assign_tag({ tag_id: tag.id, entry_id: entry.id, remove: true })
    expect(count('SELECT COUNT(*) c FROM entry_tags')).toBe(0)
    expect(on_error).not.toHaveBeenCalled()
    db.close()
  })

  test('insert_tag reuses an existing tag case-insensitively', async () => {
    const { writes, on_error, count, db } = make_harness()
    const tag = await writes.insert_tag({ name: 'Plants' })
    const duplicate = await writes.insert_tag({ name: ' plants ' })
    expect(duplicate.id).toBe(tag.id)
    expect(count('SELECT COUNT(*) c FROM tags')).toBe(1)
    expect(on_error).not.toHaveBeenCalled()
    db.close()
  })
})
