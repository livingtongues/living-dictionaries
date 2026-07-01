import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { sign_jwt } from '$lib/auth/jwt'
import { open_shared_db } from '$lib/db/server/shared-db'
import { DELETE } from './[key_id]/+server'
import { GET, POST } from './+server'

let db: ReturnType<typeof open_shared_db>

vi.mock('$lib/db/server/shared-db', async () => {
  const actual = await vi.importActual<typeof import('$lib/db/server/shared-db')>('$lib/db/server/shared-db')
  return { ...actual, get_shared_db: () => db }
})

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

beforeEach(() => {
  db = open_shared_db(':memory:')
  db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .run('mgr-1', 'mgr@x.com', 'Mgr', JSON.stringify([{ provider: 'email', provider_id: 'mgr@x.com' }]), '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
  db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .run('edt-1', 'edt@x.com', 'Edt', JSON.stringify([{ provider: 'email', provider_id: 'edt@x.com' }]), '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
  db.prepare(`INSERT INTO dictionaries (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`)
    .run('dict-1', 'Test', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
  db.prepare(`INSERT INTO dictionary_roles (id, dictionary_id, user_id, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .run('r-mgr', 'dict-1', 'mgr-1', 'manager', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
  db.prepare(`INSERT INTO dictionary_roles (id, dictionary_id, user_id, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .run('r-edt', 'dict-1', 'edt-1', 'editor', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
})

afterEach(() => db.close())

function manager_token() {
  return sign_jwt({ sub: 'mgr-1', email: 'mgr@x.com', name: 'Mgr' })
}
function editor_token() {
  return sign_jwt({ sub: 'edt-1', email: 'edt@x.com', name: 'Edt' })
}

function event({ method, token, body, key_id }: { method: string, token?: string, body?: unknown, key_id?: string }) {
  const url = key_id
    ? `http://localhost/api/dictionaries/dict-1/api-keys/${key_id}`
    : `http://localhost/api/dictionaries/dict-1/api-keys`
  const request = new Request(url, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
  const cookies = { get: (name: string) => (name === 'session' ? token : undefined) }
  return { request, cookies, params: { id: 'dict-1', key_id } } as never
}

describe(POST, () => {
  test('401 without auth', async () => {
    await expect(POST(event({ method: 'POST', body: { label: 'x' } })))
      .rejects.toMatchObject({ status: 401 })
  })

  test('403 for an editor (manager-gated)', async () => {
    await expect(POST(event({ method: 'POST', token: await editor_token(), body: { label: 'x' } })))
      .rejects.toMatchObject({ status: 403 })
  })

  test('400 without a label', async () => {
    await expect(POST(event({ method: 'POST', token: await manager_token(), body: {} })))
      .rejects.toMatchObject({ status: 400 })
  })

  test('manager mints a key; token returned once, hash stored', async () => {
    const res = await POST(event({ method: 'POST', token: await manager_token(), body: { label: 'My agent', role: 'read' } }))
    const data = await res.json()
    expect(data.token.startsWith('ldk_')).toBeTruthy()
    expect(data.key.role).toBe('read')
    const stored = db.prepare(`SELECT token_hash FROM api_keys WHERE id = ?`).get(data.key.id) as { token_hash: string }
    expect(stored.token_hash).toBeTruthy()
    // The raw token is never persisted — there is no `token` column.
    const columns = (db.prepare(`PRAGMA table_info(api_keys)`).all() as { name: string }[]).map(c => c.name)
    expect(columns).not.toContain('token')
  })
})

describe(GET, () => {
  test('lists keys without exposing the hash', async () => {
    await POST(event({ method: 'POST', token: await manager_token(), body: { label: 'k1' } }))
    const res = await GET(event({ method: 'GET', token: await manager_token() }))
    const data = await res.json()
    expect(data.keys).toHaveLength(1)
    expect(data.keys[0]).not.toHaveProperty('token_hash')
  })

  test('an editor may list keys (read-only Agents page)', async () => {
    await POST(event({ method: 'POST', token: await manager_token(), body: { label: 'k1' } }))
    const res = await GET(event({ method: 'GET', token: await editor_token() }))
    expect((await res.json()).keys).toHaveLength(1)
  })
})

describe(DELETE, () => {
  test('manager revokes a key — row retained for history, dropped from the active list', async () => {
    const created = await (await POST(event({ method: 'POST', token: await manager_token(), body: { label: 'k' } }))).json()
    const res = await DELETE(event({ method: 'DELETE', token: await manager_token(), key_id: created.key.id }))
    expect((await res.json()).result).toBe('revoked')
    // Row retained (revoke, not delete) with revoked_at set.
    expect(db.prepare(`SELECT COUNT(*) c FROM api_keys`).get()).toMatchObject({ c: 1 })
    const row = db.prepare(`SELECT revoked_at FROM api_keys WHERE id = ?`).get(created.key.id) as { revoked_at: string | null }
    expect(row.revoked_at).toBeTruthy()
    // No longer in the active list.
    const list = await (await GET(event({ method: 'GET', token: await manager_token() }))).json()
    expect(list.keys).toHaveLength(0)
  })

  test('403 for an editor (revoke is manager-gated)', async () => {
    const created = await (await POST(event({ method: 'POST', token: await manager_token(), body: { label: 'k' } }))).json()
    await expect(DELETE(event({ method: 'DELETE', token: await editor_token(), key_id: created.key.id })))
      .rejects.toMatchObject({ status: 403 })
  })

  test('404 revoking an unknown key', async () => {
    await expect(DELETE(event({ method: 'DELETE', token: await manager_token(), key_id: 'nope' })))
      .rejects.toMatchObject({ status: 404 })
  })
})
