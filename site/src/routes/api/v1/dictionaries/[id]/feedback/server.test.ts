import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

import { create_api_key } from '$lib/api-keys/api-key'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { _reset_feedback_limiter, FEEDBACK_OWNER_EMAIL, submit_agent_feedback } from '$lib/server/agent-feedback'
import { POST } from './+server'

// Silence ntfy/email pushes during tests (no network) — see notify-admins.ts.
process.env.NTFY_DISABLED = '1'

let shared_db: ReturnType<typeof open_test_shared_db>
let write_key: string
let read_key: string

vi.mock('$lib/db/server/shared-db', async orig => ({ ...(await orig<typeof import('$lib/db/server/shared-db')>()), get_shared_db: () => shared_db }))

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

beforeEach(() => {
  _reset_feedback_limiter()
  shared_db = open_test_shared_db()
  shared_db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('edt-1', 'edt@x.com', 'Edt', JSON.stringify([]), '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
  shared_db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run('owner-1', FEEDBACK_OWNER_EMAIL, 'Jacob', JSON.stringify([]), '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
  shared_db.prepare(`INSERT INTO dictionaries (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`)
    .run('dict-1', 'My Dict', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
  write_key = create_api_key({ db: shared_db, dictionary_id: 'dict-1', label: 'w', role: 'write', created_by_user_id: 'edt-1' }).token
  read_key = create_api_key({ db: shared_db, dictionary_id: 'dict-1', label: 'r', role: 'read', created_by_user_id: 'edt-1' }).token
})

afterEach(() => shared_db.close())

function post_feedback(body: unknown, key = read_key) {
  const request = new Request('http://localhost/api/v1/dictionaries/dict-1/feedback', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', 'Authorization': `Bearer ${key}` } })
  return POST({ request, cookies: { get: () => undefined }, params: { id: 'dict-1' }, url: new URL(request.url) } as never)
}

describe(POST, () => {
  test('a READ key can submit feedback → unresolved thread assigned to the owner', async () => {
    const res = await post_feedback({ message: 'I need an audio-length field', kind: 'missing_field' })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.received).toBeTruthy()
    expect(data.relay_to_human).toMatch(/Living Dictionaries team/)

    const thread = shared_db.prepare(`SELECT * FROM message_threads WHERE source = 'agent_feedback'`).get() as Record<string, string | null>
    expect(thread.resolved_at).toBeNull()
    expect(thread.assigned_to_user_id).toBe('owner-1')
    expect(thread.from_user_id).toBe('edt-1') // key creator snapshotted
    const message = shared_db.prepare(`SELECT * FROM messages WHERE thread_id = ?`).get(thread.id) as { author_kind: string, body_text: string }
    expect(message.author_kind).toBe('agent')
    expect(message.body_text).toContain('audio-length')
  })

  test('a WRITE key can also submit feedback', async () => {
    const res = await post_feedback({ message: 'works' }, write_key)
    expect(res.status).toBe(200)
  })

  test('400 on an empty message', async () => {
    await expect(post_feedback({ message: '   ' })).rejects.toMatchObject({ status: 400 })
  })

  test('rate-limits after the hourly burst (429)', async () => {
    await post_feedback({ message: '1' })
    await post_feedback({ message: '2' })
    await post_feedback({ message: '3' })
    await expect(post_feedback({ message: '4' })).rejects.toMatchObject({ status: 429 })
  })
})

describe(submit_agent_feedback, () => {
  test('folds into the newest open thread past the per-key cap', () => {
    const sender = { user_id: 'edt-1', email: 'edt@x.com', name: 'Edt' }
    const args = { db: shared_db, dictionary_id: 'dict-1', dictionary_name: 'My Dict', key_id: 'k-1', sender, kind: 'other' as const }
    const created_ids = new Set<string>()
    for (let i = 0; i < 10; i++) {
      const { appended, thread_id } = submit_agent_feedback({ ...args, message: `m${i}` })
      expect(appended).toBeFalsy()
      created_ids.add(thread_id)
    }
    // 11th → folded into one of the existing open threads, no new thread row.
    const { appended, thread_id } = submit_agent_feedback({ ...args, message: 'overflow' })
    expect(appended).toBeTruthy()
    expect(created_ids.has(thread_id)).toBeTruthy()
    const threads = shared_db.prepare(`SELECT COUNT(*) AS c FROM message_threads WHERE source = 'agent_feedback'`).get() as { c: number }
    expect(threads.c).toBe(10)
    const overflow = shared_db.prepare(`SELECT COUNT(*) AS c FROM messages WHERE thread_id = ? AND body_text LIKE '%overflow%'`).get(thread_id) as { c: number }
    expect(overflow.c).toBe(1)
  })
})
