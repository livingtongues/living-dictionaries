import type Database from 'better-sqlite3'
import { open_dictionary_db_in_memory } from '$lib/db/server/dictionary-db'
import { merge_dict_row } from '$lib/db/server/dictionary-sync-helpers'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { post_large_video_notification } from './large-video-notifier'

const NOW = '2026-01-01T00:00:00.000Z'

describe(post_large_video_notification, () => {
  let shared_db: Database.Database
  let dict_db: Database.Database

  beforeEach(() => {
    shared_db = open_test_shared_db()
    dict_db = open_dictionary_db_in_memory('dict-1')
    shared_db.prepare('INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run('user-1', 'jane@example.com', 'Jane', '[]', NOW, NOW)
    shared_db.prepare('INSERT INTO dictionaries (id, url, name, entry_count, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)')
      .run('dict-1', 'friendly', 'Dictionary One', NOW, NOW)
    merge_dict_row({ db: dict_db, table_name: 'entries', row: { id: 'entry-1', lexeme: { default: 'word' }, created_at: NOW, updated_at: NOW }, user_id: 'user-1' })
    merge_dict_row({ db: dict_db, table_name: 'senses', row: { id: 'sense-1', entry_id: 'entry-1', created_at: NOW, updated_at: NOW }, user_id: 'user-1' })
  })

  afterEach(() => {
    shared_db.close()
    dict_db.close()
  })

  test('posts one idempotent system notice with the entry link', () => {
    const dictionary = { id: 'dict-1', url: 'friendly', name: 'Dictionary One' } as Parameters<typeof post_large_video_notification>[0]['dictionary']
    const options = {
      shared_db,
      dictionary,
      dict_db,
      cell_key: 'video:sense' as const,
      owner_id: 'sense-1',
      media_id: '48af49b0-b410-4db1-babf-38ac53269e62',
      size_bytes: 31.2 * 1024 * 1024,
      actor_user_id: 'user-1',
      base_url: 'https://livingdictionaries.app',
    }

    expect(post_large_video_notification(options)).toBeTruthy()
    expect(post_large_video_notification(options)).toBeTruthy()

    const messages = shared_db.prepare('SELECT body_text FROM chat_messages WHERE room_id = ?').all('notifications') as { body_text: string }[]
    expect(messages).toHaveLength(1)
    expect(messages[0].body_text).toContain('Jane uploaded a 31.2 MiB video for review')
    expect(messages[0].body_text).toContain('https://livingdictionaries.app/friendly/entry/entry-1')
  })

  test('does not post when the sense cannot be resolved to an entry', () => {
    const dictionary = { id: 'dict-1', url: 'friendly', name: 'Dictionary One' } as Parameters<typeof post_large_video_notification>[0]['dictionary']
    expect(post_large_video_notification({
      shared_db,
      dictionary,
      dict_db,
      cell_key: 'video:sense',
      owner_id: 'missing',
      media_id: '48af49b0-b410-4db1-babf-38ac53269e62',
      size_bytes: 30 * 1024 * 1024,
      actor_user_id: 'user-1',
      base_url: 'https://livingdictionaries.app',
    })).toBeFalsy()
    expect(shared_db.prepare('SELECT COUNT(*) AS count FROM chat_messages').get()).toEqual({ count: 0 })
  })
})
