import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { sign_jwt } from '$lib/auth/jwt'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { POST } from './+server'

let db: ReturnType<typeof open_test_shared_db>

vi.mock('$lib/db/server/shared-db', async () => {
  const actual = await vi.importActual<typeof import('$lib/db/server/shared-db')>('$lib/db/server/shared-db')
  return { ...actual, get_shared_db: () => db }
})

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

beforeEach(() => {
  db = open_test_shared_db()
  const now = '2026-06-23T00:00:00.000Z'
  db.prepare(`
    INSERT INTO users (id, email, name, providers, created_at, updated_at)
    VALUES (?, ?, ?, '[]', ?, ?)
  `).run('u1', 'speaker@example.com', 'Speaker', now, now)
  db.prepare(`
    INSERT INTO message_threads (
      id, subject, source, from_user_id, from_email, from_name, last_message_at, created_at, updated_at
    ) VALUES (?, ?, 'email', NULL, ?, ?, ?, ?, ?)
  `).run('t1', 'Help with my dictionary', 'no-reply@livingdictionaries.app', 'Living Dictionaries', now, now, now)
})

afterEach(() => {
  db.close()
})

function admin_token() {
  return sign_jwt({ sub: 'admin-id', email: 'jwrunner7@gmail.com', name: 'Jacob' })
}

async function call(body: unknown, options: { token?: string } = {}) {
  const token = options.token ?? await admin_token()
  const request = new Request('http://localhost/api/admin/match-thread-to-user', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  return POST({ request } as Parameters<typeof POST>[0])
}

describe(POST, () => {
  test('403 for a non-admin', async () => {
    const token = await sign_jwt({ sub: 'x', email: 'stranger@example.com', name: 'Nope' })
    await expect(call({ thread_id: 't1', user_id: 'u1' }, { token })).rejects.toMatchObject({ status: 403 })
  })

  test('links thread to user but skips alias for no-reply senders', async () => {
    const response = await call({ thread_id: 't1', user_id: 'u1' })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.alias_inserted).toBeFalsy()

    const thread = db.prepare('SELECT from_user_id FROM message_threads WHERE id = ?').get('t1') as { from_user_id: string }
    expect(thread.from_user_id).toBe('u1')

    const alias = db.prepare('SELECT email FROM email_aliases WHERE email = ?').get('no-reply@livingdictionaries.app')
    expect(alias).toBeUndefined()
  })

  test('still inserts alias for normal customer senders + backfills messages', async () => {
    db.prepare('UPDATE message_threads SET from_email = ? WHERE id = ?').run('other@example.com', 't1')
    const now = '2026-06-23T00:00:00.000Z'
    db.prepare(`
      INSERT INTO messages (id, thread_id, author_user_id, author_kind, body_text, created_at, updated_at)
      VALUES (?, ?, NULL, 'customer', ?, ?, ?)
    `).run('m1', 't1', 'hello', now, now)

    const response = await call({ thread_id: 't1', user_id: 'u1' })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.alias_inserted).toBeTruthy()
    expect(body.messages_backfilled).toBe(1)

    const alias = db.prepare('SELECT user_id FROM email_aliases WHERE email = ?').get('other@example.com') as { user_id: string }
    expect(alias.user_id).toBe('u1')
    const message = db.prepare('SELECT author_user_id FROM messages WHERE id = ?').get('m1') as { author_user_id: string }
    expect(message.author_user_id).toBe('u1')
  })
})
