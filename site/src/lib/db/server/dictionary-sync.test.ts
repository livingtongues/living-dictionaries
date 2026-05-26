import type { DictChangesRequest } from './dictionary-sync-helpers'
import { open_dictionary_db_in_memory } from './dictionary-db'
import { process_dict_changes } from './dictionary-sync-helpers'

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
          deleted: null,
          dirty: 1,
          created_by_user_id: 'u1',
          created_at: now,
          updated_by_user_id: 'u1',
          updated_at: now,
        }],
      },
      deletes: [],
      latest_dict_migration: '20260525_initial.sql',
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
            deleted: null,
            dirty: 1,
            created_by_user_id: 'editor',
            created_at: now,
            updated_by_user_id: 'editor',
            updated_at: now,
          }],
        },
        deletes: [],
        latest_dict_migration: '20260525_initial.sql',
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
            deleted: null,
            dirty: 1,
            created_by_user_id: 'viewer',
            created_at: now,
            updated_by_user_id: 'viewer',
            updated_at: now,
          }],
        },
        deletes: [],
        latest_dict_migration: '20260525_initial.sql',
      },
      user_id: '',
      is_editor: false,
    })

    expect(response.changes.entries?.find(e => e.id === 'entry_seed')).toBeTruthy()
    const blocked = db.prepare('SELECT id FROM entries WHERE id = ?').get('viewer_attempt')
    expect(blocked).toBeUndefined()
    db.close()
  })

  test('soft-delete via tombstone propagates through the trigger', () => {
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
            deleted: null,
            dirty: 1,
            created_by_user_id: 'editor',
            created_at: now,
            updated_by_user_id: 'editor',
            updated_at: now,
          }],
        },
        deletes: [],
        latest_dict_migration: '20260525_initial.sql',
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
        latest_dict_migration: '20260525_initial.sql',
      },
      user_id: 'editor',
      is_editor: true,
    })

    const row = db.prepare('SELECT deleted FROM entries WHERE id = ?').get('entry_doomed') as { deleted: string | null }
    expect(row.deleted).toBeTruthy() // soft-deleted (deleted timestamp set)
    db.close()
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
            deleted: null,
            dirty: 1,
            created_by_user_id: 'a',
            created_at: t2,
            updated_by_user_id: 'a',
            updated_at: t2,
          }],
        },
        deletes: [],
        latest_dict_migration: '20260525_initial.sql',
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
            deleted: null,
            dirty: 1,
            created_by_user_id: 'b',
            created_at: t1,
            updated_by_user_id: 'b',
            updated_at: t1,
          }],
        },
        deletes: [],
        latest_dict_migration: '20260525_initial.sql',
      },
      user_id: 'b',
      is_editor: true,
    })

    const row = db.prepare('SELECT lexeme FROM entries WHERE id = ?').get('shared_entry') as { lexeme: string }
    expect(JSON.parse(row.lexeme)).toEqual({ en: 'editor_a_version' })
    db.close()
  })
})
