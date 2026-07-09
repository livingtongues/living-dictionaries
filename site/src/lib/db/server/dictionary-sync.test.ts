import type { DictChangesRequest } from './dictionary-sync-helpers'
import { open_dictionary_db_in_memory } from './dictionary-db'
import { DICT_NATURAL_KEY_COLUMNS, process_dict_changes } from './dictionary-sync-helpers'

describe('dictionary.db push + pull', () => {
  test('fresh dict + push entry → row lands + last_modified_at advances', () => {
    const db = open_dictionary_db_in_memory('test_dict')
    const now = new Date().toISOString()

    const request: DictChangesRequest = {
      synced_up_to: null,
      dirty_rows: {
        entries: [{
          id: 'entry_1',
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
          created_at: now,
          updated_by_user_id: 'u1',
          updated_at: now,
        }],
      },
      deletes: [],
      latest_dict_migration: '20260606_initial.sql',
    }

    const response = process_dict_changes({ db, request, user_id: 'u1', is_editor: true })
    expect(response.new_synced_up_to).toBeTruthy()

    const row = db.prepare('SELECT id, lexeme FROM entries WHERE id = ?').get('entry_1') as { id: string, lexeme: string }
    expect(row).toBeTruthy()
    expect(JSON.parse(row.lexeme)).toEqual({ en: 'hello' })

    // last_modified_at must be set (the trigger fires on every content write).
    const lmod = db.prepare(`SELECT value FROM db_metadata WHERE key = 'last_modified_at'`).get() as { value: string }
    expect(lmod.value).toBeTruthy()
    db.close()
  })

  test('viewer (is_editor=false) cannot push but can pull', () => {
    const db = open_dictionary_db_in_memory('test_dict')
    const now = new Date().toISOString()

    // Editor seeds an entry.
    process_dict_changes({
      db,
      request: {
        synced_up_to: null,
        dirty_rows: {
          entries: [{
            id: 'entry_seed',
            lexeme: { en: 'seed' },
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
            created_by_user_id: 'editor',
            created_at: now,
            updated_by_user_id: 'editor',
            updated_at: now,
          }],
        },
        deletes: [],
        latest_dict_migration: '20260606_initial.sql',
      },
      user_id: 'editor',
      is_editor: true,
    })

    // Viewer tries to push a different row + pull.
    const response = process_dict_changes({
      db,
      request: {
        synced_up_to: null,
        dirty_rows: {
          entries: [{
            id: 'viewer_attempt',
            lexeme: { en: 'should not land' },
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
            created_by_user_id: 'viewer',
            created_at: now,
            updated_by_user_id: 'viewer',
            updated_at: now,
          }],
        },
        deletes: [],
        latest_dict_migration: '20260606_initial.sql',
      },
      user_id: '',
      is_editor: false,
    })

    expect(response.changes.entries?.find(e => e.id === 'entry_seed')).toBeTruthy()
    const blocked = db.prepare('SELECT id FROM entries WHERE id = ?').get('viewer_attempt')
    expect(blocked).toBeUndefined()
    db.close()
  })

  test('hard-delete via tombstone removes the row + propagates to peers', () => {
    const db = open_dictionary_db_in_memory('test_dict')
    const now = new Date().toISOString()

    process_dict_changes({
      db,
      request: {
        synced_up_to: null,
        dirty_rows: {
          entries: [{
            id: 'entry_doomed',
            lexeme: { en: 'doomed' },
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
            created_by_user_id: 'editor',
            created_at: now,
            updated_by_user_id: 'editor',
            updated_at: now,
          }],
        },
        deletes: [],
        latest_dict_migration: '20260606_initial.sql',
      },
      user_id: 'editor',
      is_editor: true,
    })

    process_dict_changes({
      db,
      request: {
        synced_up_to: now,
        dirty_rows: {},
        deletes: [{ table_name: 'entries', id: 'entry_doomed' }],
        latest_dict_migration: '20260606_initial.sql',
      },
      user_id: 'editor',
      is_editor: true,
    })

    // Row is hard-deleted (gone, not merely flagged) and the tombstone is logged.
    const row = db.prepare('SELECT id FROM entries WHERE id = ?').get('entry_doomed')
    expect(row).toBeUndefined()
    const tombstone = db.prepare(`SELECT id FROM deletes WHERE table_name = 'entries' AND id = ?`).get('entry_doomed')
    expect(tombstone).toBeTruthy()

    // A peer behind the delete pulls the tombstone (row no longer exists → forwarded).
    const peer_response = process_dict_changes({
      db,
      request: {
        synced_up_to: '2026-01-01T00:00:00.000Z',
        dirty_rows: {},
        deletes: [],
        latest_dict_migration: '20260606_initial.sql',
      },
      user_id: 'peer',
      is_editor: false,
    })
    expect(peer_response.deletes).toContainEqual({ table_name: 'entries', id: 'entry_doomed' })
    db.close()
  })

  test('FK-orphan push: skips the dangling child, lands the rest, reports it', () => {
    const db = open_dictionary_db_in_memory('test_dict')
    const now = new Date().toISOString()

    // One valid entry + one orphaned sense (entry_id points at a row that does
    // not exist) in the SAME batch. Under defer_foreign_keys the orphan would
    // trip at COMMIT and roll back BOTH; the recovery path must skip only the
    // orphan and still land the good entry.
    const response = process_dict_changes({
      db,
      request: {
        synced_up_to: null,
        dirty_rows: {
          entries: [{
            id: 'good_entry',
            lexeme: { en: 'lands' },
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
            created_by_user_id: 'editor',
            created_at: now,
            updated_by_user_id: 'editor',
            updated_at: now,
          }],
          senses: [{
            id: 'orphan_sense',
            entry_id: 'missing_entry',
            definition: null,
            glosses: { en: 'orphan' },
            parts_of_speech: null,
            semantic_domains: null,
            write_in_semantic_domains: null,
            noun_class: null,
            plural_form: null,
            variant: null,
            dirty: 1,
            created_by_user_id: 'editor',
            created_at: now,
            updated_by_user_id: 'editor',
            updated_at: now,
          }],
        },
        deletes: [],
        latest_dict_migration: '20260606_initial.sql',
      },
      user_id: 'editor',
      is_editor: true,
    })

    // Good row landed; orphan did not; the batch did NOT 500.
    expect(db.prepare('SELECT id FROM entries WHERE id = ?').get('good_entry')).toBeTruthy()
    expect(db.prepare('SELECT id FROM senses WHERE id = ?').get('orphan_sense')).toBeUndefined()
    expect(response.skipped_orphans).toEqual([{ table_name: 'senses', id: 'orphan_sense', parent_table: 'entries' }])
    db.close()
  })

  test('non-FK errors still throw (recovery path is FK-only)', () => {
    const db = open_dictionary_db_in_memory('test_dict')
    db.close() // Operating on a closed db throws a non-FK SqliteError.

    expect(() => process_dict_changes({
      db,
      request: { synced_up_to: null, dirty_rows: {}, deletes: [], latest_dict_migration: '20260606_initial.sql' },
      user_id: 'editor',
      is_editor: true,
    })).toThrow()
  })

  test('last-write-wins conflict resolution', () => {
    const db = open_dictionary_db_in_memory('test_dict')
    const t1 = '2026-05-25T10:00:00.000Z'
    const t2 = '2026-05-25T11:00:00.000Z'

    // Editor A writes at t2.
    process_dict_changes({
      db,
      request: {
        synced_up_to: null,
        dirty_rows: {
          entries: [{
            id: 'shared_entry',
            lexeme: { en: 'editor_a_version' },
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
            created_by_user_id: 'a',
            created_at: t2,
            updated_by_user_id: 'a',
            updated_at: t2,
          }],
        },
        deletes: [],
        latest_dict_migration: '20260606_initial.sql',
      },
      user_id: 'a',
      is_editor: true,
    })

    // Editor B tries to overwrite with an OLDER updated_at — should be rejected.
    process_dict_changes({
      db,
      request: {
        synced_up_to: null,
        dirty_rows: {
          entries: [{
            id: 'shared_entry',
            lexeme: { en: 'editor_b_older' },
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
            created_by_user_id: 'b',
            created_at: t1,
            updated_by_user_id: 'b',
            updated_at: t1,
          }],
        },
        deletes: [],
        latest_dict_migration: '20260606_initial.sql',
      },
      user_id: 'b',
      is_editor: true,
    })

    const row = db.prepare('SELECT lexeme FROM entries WHERE id = ?').get('shared_entry') as { lexeme: string }
    expect(JSON.parse(row.lexeme)).toEqual({ en: 'editor_a_version' })
    db.close()
  })
})

describe('junction natural-key collision (two clients, different ids, same pair)', () => {
  const empty_entry = (id: string, at: string) => ({
    id,
    lexeme: { en: id },
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
  })

  const tag_row = (id: string, at: string) => ({
    id,
    name: id,
    private: null,
    dirty: 1,
    created_by_user_id: 'u1',
    created_at: at,
    updated_by_user_id: 'u1',
    updated_at: at,
  })

  const link_row = ({ id, user, at }: { id: string, user: string, at: string }) => ({
    id,
    entry_id: 'e1',
    tag_id: 't1',
    dirty: 1,
    created_by_user_id: user,
    created_at: at,
    updated_by_user_id: user,
    updated_at: at,
  })

  function seed_entry_and_tag(db: ReturnType<typeof open_dictionary_db_in_memory>, at: string) {
    process_dict_changes({
      db,
      request: {
        synced_up_to: null,
        dirty_rows: { entries: [empty_entry('e1', at)], tags: [tag_row('t1', at)] },
        deletes: [],
        latest_dict_migration: '20260606_initial.sql',
      },
      user_id: 'u1',
      is_editor: true,
    })
  }

  test('second client pushing the same (entry_id, tag_id) with a new id does not 500 and leaves one row', () => {
    const db = open_dictionary_db_in_memory('test_dict')
    const t1 = '2026-07-07T00:00:00.000Z'
    const t2 = '2026-07-07T00:00:01.000Z'
    seed_entry_and_tag(db, t1)

    // Client A links e1↔t1 as link_A.
    process_dict_changes({
      db,
      request: { synced_up_to: null, dirty_rows: { entry_tags: [link_row({ id: 'link_A', user: 'a', at: t1 })] }, deletes: [], latest_dict_migration: '20260606_initial.sql' },
      user_id: 'a',
      is_editor: true,
    })

    // Client B independently links the SAME pair as link_B (a different UUID) — this
    // is the collision that used to throw `UNIQUE constraint failed: entry_tags.entry_id`.
    expect(() => process_dict_changes({
      db,
      request: { synced_up_to: null, dirty_rows: { entry_tags: [link_row({ id: 'link_B', user: 'b', at: t2 })] }, deletes: [], latest_dict_migration: '20260606_initial.sql' },
      user_id: 'b',
      is_editor: true,
    })).not.toThrow()

    const rows = db.prepare('SELECT id, updated_by_user_id FROM entry_tags').all() as { id: string, updated_by_user_id: string }[]
    expect(rows).toHaveLength(1)
    // Deduped onto the canonical (first-seen) id, with the newer push's content merged.
    expect(rows[0].id).toBe('link_A')
    expect(rows[0].updated_by_user_id).toBe('b')
    db.close()
  })

  test('an older duplicate push loses LWW and does not clobber the canonical row', () => {
    const db = open_dictionary_db_in_memory('test_dict')
    const older = '2026-07-07T00:00:00.000Z'
    const newer = '2026-07-07T00:00:05.000Z'
    seed_entry_and_tag(db, older)

    process_dict_changes({
      db,
      request: { synced_up_to: null, dirty_rows: { entry_tags: [link_row({ id: 'link_A', user: 'a', at: newer })] }, deletes: [], latest_dict_migration: '20260606_initial.sql' },
      user_id: 'a',
      is_editor: true,
    })

    // A stale second-client link with an OLDER updated_at must not win.
    process_dict_changes({
      db,
      request: { synced_up_to: null, dirty_rows: { entry_tags: [link_row({ id: 'link_B', user: 'b', at: older })] }, deletes: [], latest_dict_migration: '20260606_initial.sql' },
      user_id: 'b',
      is_editor: true,
    })

    const rows = db.prepare('SELECT id, updated_by_user_id FROM entry_tags').all() as { id: string, updated_by_user_id: string }[]
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('link_A')
    expect(rows[0].updated_by_user_id).toBe('a')
    db.close()
  })
})

describe('junction natural-key dedup echoes the loser delete + canonical row (client convergence)', () => {
  const at = '2026-07-07T00:00:00.000Z'
  const newer = '2026-07-07T00:00:05.000Z'

  function seed(db: ReturnType<typeof open_dictionary_db_in_memory>) {
    db.prepare(`INSERT INTO entries (id, lexeme, created_by_user_id, updated_by_user_id, created_at, updated_at) VALUES ('e1', '{}', 'u1', 'u1', ?, ?)`).run(at, at)
    db.prepare(`INSERT INTO tags (id, name, created_by_user_id, updated_by_user_id, created_at, updated_at) VALUES ('t1', 'tag', 'u1', 'u1', ?, ?)`).run(at, at)
    db.prepare(`INSERT INTO entry_tags (id, entry_id, tag_id, created_by_user_id, updated_by_user_id, created_at, updated_at) VALUES ('link_A', 'e1', 't1', 'u1', 'u1', ?, ?)`).run(at, at)
  }

  const loser_push = (updated_at: string): DictChangesRequest => ({
    synced_up_to: at,
    dirty_rows: { entry_tags: [{ id: 'link_B', entry_id: 'e1', tag_id: 't1', created_by_user_id: 'b', created_at: updated_at, updated_by_user_id: 'b', updated_at }] },
    deletes: [],
    latest_dict_migration: '20260606_initial.sql',
  })

  test('a deduped fresh mint gets response.deletes for the loser id + the canonical row echoed', () => {
    const db = open_dictionary_db_in_memory('test_dict')
    seed(db)

    const response = process_dict_changes({ db, request: loser_push(newer), user_id: 'b', is_editor: true })

    // Loser delete echoed (so the pushing client drops its local copy BEFORE
    // upserting the canonical row — otherwise it wedges on the UNIQUE key)…
    expect(response.deletes).toContainEqual({ table_name: 'entry_tags', id: 'link_B' })
    // …AND a server tombstone recorded so any other holder of link_B converges.
    const tombstone = db.prepare(`SELECT 1 FROM deletes WHERE table_name = 'entry_tags' AND id = 'link_B'`).get()
    expect(tombstone).toBeTruthy()
    // …AND the canonical row echoed explicitly (its updated_at may predate the
    // client's cursor, so the normal pull filter can miss it).
    expect((response.changes.entry_tags ?? []).map(row => row.id)).toContain('link_A')
    db.close()
  })

  test('an LWW-losing duplicate push still tombstones + echoes (server-wins branch must converge too)', () => {
    const db = open_dictionary_db_in_memory('test_dict')
    seed(db)
    // Make the canonical row NEWER than the pushed loser.
    db.prepare(`UPDATE entry_tags SET updated_at = ? WHERE id = 'link_A'`).run(newer)

    const response = process_dict_changes({ db, request: loser_push(at), user_id: 'b', is_editor: true })

    expect(response.deletes).toContainEqual({ table_name: 'entry_tags', id: 'link_B' })
    expect((response.changes.entry_tags ?? []).map(row => row.id)).toContain('link_A')
    // Canonical content untouched (LWW held).
    const row = db.prepare(`SELECT updated_by_user_id FROM entry_tags WHERE id = 'link_A'`).get() as { updated_by_user_id: string }
    expect(row.updated_by_user_id).toBe('u1')
    db.close()
  })
})

describe('DICT_NATURAL_KEY_COLUMNS leaf-ness guard', () => {
  test('no table FK-references a natural-key table (adopt-canonical without FK-remap relies on this)', () => {
    // If a dedup-able table ever gains an FK referrer, adopting the canonical id
    // + tombstoning the loser would cascade the referrer away on the pushing
    // client (house needed an FK-rewrite echo for exactly this). This guard
    // forces that design conversation instead of silently shipping drift.
    const db = open_dictionary_db_in_memory('test_dict')
    const natural_key_tables = new Set(Object.keys(DICT_NATURAL_KEY_COLUMNS))
    const tables = (db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as { name: string }[]).map(row => row.name)
    const referrers: string[] = []
    for (const table of tables) {
      const fks = db.pragma(`foreign_key_list("${table}")`) as { table: string }[]
      for (const fk of fks) {
        if (natural_key_tables.has(fk.table))
          referrers.push(`${table} → ${fk.table}`)
      }
    }
    expect(referrers).toEqual([])
    db.close()
  })
})
