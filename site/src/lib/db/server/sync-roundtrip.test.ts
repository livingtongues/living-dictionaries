import type { SyncRequest } from '$lib/db/sync/types'
import { latest_shared_migration_name, open_shared_db } from './shared-db'
import { process_sync } from './sync-helpers'

describe('shared.db admin-sync roundtrip', () => {
  test('migration version handshake throws on mismatch', () => {
    const db = open_shared_db(':memory:')
    const request: SyncRequest = {
      synced_up_to: null,
      dirty_rows: {},
      deletes: [],
      latest_migration: 'wrong_version.sql',
    }
    expect(() => process_sync({ db, request })).toThrow(/Migration version mismatch/)
    db.close()
  })

  test('first sync: empty in, empty out', () => {
    const db = open_shared_db(':memory:')
    const request: SyncRequest = {
      synced_up_to: null,
      dirty_rows: {},
      deletes: [],
      latest_migration: latest_shared_migration_name,
    }
    const response = process_sync({ db, request })
    expect(response.changes).toEqual({})
    expect(response.deletes).toEqual([])
    expect(response.new_synced_up_to).toBeNull()
    db.close()
  })

  test('client uploads a user, server stores it, next sync sees it', () => {
    const db = open_shared_db(':memory:')
    const now = new Date().toISOString()

    const push: SyncRequest = {
      synced_up_to: null,
      dirty_rows: {
        users: [
          {
            id: 'u_alice',
            email: 'alice@example.com',
            name: 'Alice',
            avatar_url: null,
            providers: [{ provider: 'email', provider_id: 'alice@example.com' }],
            unsubscribed_from_emails: null,
            preferred_locale: null,
            last_visit_at: null,
            created_at: now,
            updated_at: now,
          },
        ],
      },
      deletes: [],
      latest_migration: latest_shared_migration_name,
    }
    const push_response = process_sync({ db, request: push })
    expect(push_response.changes.users ?? []).toEqual([])
    expect(push_response.new_synced_up_to).toBe(now)

    // Verify the row landed in shared.db.
    const row = db.prepare('SELECT id, email, name, providers FROM users WHERE id = ?').get('u_alice') as { id: string, email: string, name: string, providers: string }
    expect(row).toBeTruthy()
    expect(row.email).toBe('alice@example.com')
    expect(JSON.parse(row.providers)).toEqual([{ provider: 'email', provider_id: 'alice@example.com' }])

    // Another client with empty cursor pulls Alice down.
    const pull_response = process_sync({
      db,
      request: { ...push, dirty_rows: {}, synced_up_to: null },
    })
    expect(pull_response.changes.users?.length).toBe(1)
    expect(pull_response.changes.users![0].id).toBe('u_alice')
    db.close()
  })

  test('dictionary insert/update flows through', () => {
    const db = open_shared_db(':memory:')
    const now = new Date().toISOString()

    const push: SyncRequest = {
      synced_up_to: null,
      dirty_rows: {
        users: [{
          id: 'u_jacob',
          email: 'jacob@example.com',
          name: 'Jacob',
          avatar_url: null,
          providers: [],
          unsubscribed_from_emails: null,
          preferred_locale: null,
          last_visit_at: null,
          created_at: now,
          updated_at: now,
        }],
        dictionaries: [{
          id: 'tlh',
          url: 'klingon',
          name: 'Klingon',
          alternate_names: null,
          gloss_languages: ['en'],
          location: null,
          coordinates: null,
          iso_639_3: 'tlh',
          glottocode: null,
          public: 1,
          print_access: null,
          metadata: null,
          entry_count: 0,
          orthographies: null,
          featured_image: null,
          author_connection: null,
          community_permission: null,
          language_used_by_community: null,
          con_language_description: null,
          copyright: null,
          hide_living_tongues_logo: null,
          snapshot_uploaded_at: null,
          dict_db_schema_version: null,
          created_at: now,
          created_by_user_id: 'u_jacob',
          updated_at: now,
          updated_by_user_id: 'u_jacob',
        }],
      },
      deletes: [],
      latest_migration: latest_shared_migration_name,
    }
    const response = process_sync({ db, request: push })
    expect(response.new_synced_up_to).toBe(now)
    const dict_row = db.prepare('SELECT id, name, gloss_languages FROM dictionaries WHERE id = ?').get('tlh') as { id: string, name: string, gloss_languages: string }
    expect(dict_row.name).toBe('Klingon')
    expect(JSON.parse(dict_row.gloss_languages)).toEqual(['en'])
    db.close()
  })

  test('tombstone propagates as a delete', () => {
    const db = open_shared_db(':memory:')
    // Use a fixed older timestamp so the tombstone (written with SQLite's
    // current strftime) is reliably > the watermark.
    const now = '2026-05-25T00:00:00.000Z'

    process_sync({
      db,
      request: {
        synced_up_to: null,
        dirty_rows: {
          users: [{
            id: 'u_ephemeral',
            email: 'ephemeral@example.com',
            name: 'Ephemeral',
            avatar_url: null,
            providers: [],
            unsubscribed_from_emails: null,
            preferred_locale: null,
            last_visit_at: null,
            created_at: now,
            updated_at: now,
          }],
          dictionaries: [{
            id: 'doomed',
            url: 'doomed',
            name: 'Doomed',
            alternate_names: null,
            gloss_languages: null,
            location: null,
            coordinates: null,
            iso_639_3: null,
            glottocode: null,
            public: null,
            print_access: null,
            metadata: null,
            entry_count: 0,
            orthographies: null,
            featured_image: null,
            author_connection: null,
            community_permission: null,
            language_used_by_community: null,
            con_language_description: null,
            copyright: null,
            hide_living_tongues_logo: null,
            snapshot_uploaded_at: null,
            dict_db_schema_version: null,
            created_at: now,
            created_by_user_id: 'u_ephemeral',
            updated_at: now,
            updated_by_user_id: 'u_ephemeral',
          }],
        },
        deletes: [],
        latest_migration: latest_shared_migration_name,
      },
    })

    // Tombstone the dictionary
    process_sync({
      db,
      request: {
        synced_up_to: now,
        dirty_rows: {},
        deletes: [{ table_name: 'dictionaries', id: 'doomed' }],
        latest_migration: latest_shared_migration_name,
      },
    })

    const row = db.prepare('SELECT id FROM dictionaries WHERE id = ?').get('doomed')
    expect(row).toBeUndefined()
    const tombstone = db.prepare('SELECT id FROM deletes WHERE table_name = ? AND id = ?').get('dictionaries', 'doomed')
    expect(tombstone).toBeTruthy()

    // Another client pulling with older watermark sees the delete.
    const pull = process_sync({
      db,
      request: {
        synced_up_to: now,
        dirty_rows: {},
        deletes: [],
        latest_migration: latest_shared_migration_name,
      },
    })
    expect(pull.deletes.find(d => d.id === 'doomed')).toBeTruthy()
    db.close()
  })
})
