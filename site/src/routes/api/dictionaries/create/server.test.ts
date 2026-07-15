import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { sign_jwt } from '$lib/auth/jwt'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { POST } from './+server'

let db: ReturnType<typeof open_test_shared_db>

vi.mock('$lib/db/server/shared-db', async () => {
  const actual = await vi.importActual<typeof import('$lib/db/server/shared-db')>('$lib/db/server/shared-db')
  return { ...actual, get_shared_db: () => db }
})
vi.mock('$api/email/new_dictionary/dictionary-emails', () => ({
  send_new_dictionary_creator_email: () => Promise.resolve(),
}))
vi.mock('$lib/server/chat/system-notifier', () => ({
  post_system_notification: () => undefined,
}))

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

beforeEach(() => {
  db = open_test_shared_db()
  db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .run('u-1', 'u@x.com', 'U', JSON.stringify([{ provider: 'email', provider_id: 'u@x.com' }]), '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
})

afterEach(() => db.close())

function event({ token, body }: { token: string, body: unknown }) {
  const request = new Request('http://localhost/api/dictionaries/create', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
  const cookies = { get: (name: string) => (name === 'session' ? token : undefined) }
  return { request, cookies } as never
}

const base = { name: 'Test Lang', gloss_languages: ['en'] }

describe(POST, () => {
  test('conlang:true auto-buckets the new dictionary as conlang', async () => {
    const token = await sign_jwt({ sub: 'u-1', email: 'u@x.com', name: 'U' })
    const res = await POST(event({ token, body: { ...base, id: 'my-conlang', conlang: true } }))
    const { id } = await res.json()
    const row = db.prepare(`SELECT bucket FROM dictionaries WHERE id = ?`).get(id) as { bucket: string | null }
    expect(row.bucket).toBe('conlang')
  })

  test('a normal (non-conlang) dictionary is left unbucketed', async () => {
    const token = await sign_jwt({ sub: 'u-1', email: 'u@x.com', name: 'U' })
    const res = await POST(event({ token, body: { ...base, id: 'real-lang', conlang: false } }))
    const { id } = await res.json()
    const row = db.prepare(`SELECT bucket FROM dictionaries WHERE id = ?`).get(id) as { bucket: string | null }
    expect(row.bucket).toBe(null)
  })
})
