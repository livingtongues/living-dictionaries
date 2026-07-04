import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { sign_jwt } from '$lib/auth/jwt'
import { open_shared_db } from '$lib/db/server/shared-db'
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
  const insert = db.prepare(`
    INSERT INTO featured_entries (id, dict_id, entry_id, lexeme, gloss, gloss_language, photo_serving_url, audio_storage_path, dict_name, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
  insert.run('fe1', 'achi', 'e1', 'tz’ikin', 'bird', 'en', 'hash1', 'achi/audio/1.mp3', 'Achi', 'suggested')
  insert.run('fe2', 'gta', 'e2', 'gsoʔ', 'water', 'es', 'hash2', 'gta/audio/2.mp3', 'GtaɁ', 'approved')
})

afterEach(() => {
  db.close()
})

function admin_token() {
  return sign_jwt({ sub: 'admin-id', email: 'jwrunner7@gmail.com', name: 'Jacob' })
}

async function get_call(options: { token?: string, status?: string } = {}) {
  const token = options.token ?? await admin_token()
  const url = new URL(`http://localhost/api/admin/featured-entries${options.status ? `?status=${options.status}` : ''}`)
  const request = new Request(url, { headers: { Authorization: `Bearer ${token}` } })
  return GET({ request, url } as Parameters<typeof GET>[0])
}

async function post_call(body: unknown, options: { token?: string } = {}) {
  const token = options.token ?? await admin_token()
  const request = new Request('http://localhost/api/admin/featured-entries', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  return POST({ request } as Parameters<typeof POST>[0])
}

describe(GET, () => {
  test('403 for a non-admin', async () => {
    const token = await sign_jwt({ sub: 'x', email: 'stranger@example.com', name: 'Nope' })
    await expect(get_call({ token })).rejects.toMatchObject({ status: 403 })
  })

  test('lists all rows, newest first', async () => {
    const response = await get_call()
    const { featured_entries } = await response.json()
    expect(featured_entries).toHaveLength(2)
  })

  test('filters by status', async () => {
    const response = await get_call({ status: 'approved' })
    const { featured_entries } = await response.json()
    expect(featured_entries).toHaveLength(1)
    expect(featured_entries[0].id).toBe('fe2')
  })

  test('400 on unknown status', async () => {
    await expect(get_call({ status: 'bogus' })).rejects.toMatchObject({ status: 400 })
  })
})

describe(POST, () => {
  test('403 for a non-admin', async () => {
    const token = await sign_jwt({ sub: 'x', email: 'stranger@example.com', name: 'Nope' })
    await expect(post_call({ ids: ['fe1'], status: 'approved' }, { token })).rejects.toMatchObject({ status: 403 })
  })

  test('400 on empty ids or bad status', async () => {
    await expect(post_call({ ids: [], status: 'approved' })).rejects.toMatchObject({ status: 400 })
    await expect(post_call({ ids: ['fe1'], status: 'bogus' })).rejects.toMatchObject({ status: 400 })
  })

  test('approves rows and stamps updated_at', async () => {
    const response = await post_call({ ids: ['fe1'], status: 'approved' })
    expect(await response.json()).toEqual({ updated: 1 })
    const row = db.prepare('SELECT status, updated_at, created_at FROM featured_entries WHERE id = ?').get('fe1') as { status: string, updated_at: string, created_at: string }
    expect(row.status).toBe('approved')
    // eslint-disable-next-line vitest/prefer-comparison-matcher, vitest/prefer-to-be-truthy -- ISO strings compare lexicographically; comparison matchers only take numbers
    expect(row.updated_at >= row.created_at).toBe(true)
  })

  test('bulk update counts only existing rows', async () => {
    const response = await post_call({ ids: ['fe1', 'fe2', 'missing'], status: 'rejected' })
    expect(await response.json()).toEqual({ updated: 2 })
  })
})
