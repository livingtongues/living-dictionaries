import type { TranslateApproveResponse } from './+server'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { open_shared_db } from '$lib/db/server/shared-db'
import { upsert_translation } from '$lib/server/i18n/i18n-db'
import { make_cookies, seed_translate, STRANGER, token_for, TRANSLATOR } from '../_test-helpers'
import { POST } from './+server'

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
  seed_translate({ db })
})

afterEach(() => {
  db.close()
})

function call(options: { token?: string, body: unknown }) {
  const request = new Request('http://localhost/api/translate/approve', {
    method: 'POST',
    body: JSON.stringify(options.body),
    headers: { 'content-type': 'application/json' },
  })
  return POST({ request, cookies: make_cookies(options.token) } as unknown as Parameters<typeof POST>[0])
}

describe(POST, () => {
  test('401/403 gates', async () => {
    await expect(call({ body: { key_id: 'misc.add', locale: 'es' } })).rejects.toMatchObject({ status: 401 })
    await expect(call({ token: await token_for(STRANGER), body: { key_id: 'misc.add', locale: 'es' } }))
      .rejects.toMatchObject({ status: 403 })
  })

  test('404 when there is nothing to approve', async () => {
    await expect(call({ token: await token_for(TRANSLATOR), body: { key_id: 'misc.add', locale: 'es' } }))
      .rejects.toMatchObject({ status: 404 })
  })

  test('approving a flagged AI value clears the flag and re-attributes', async () => {
    upsert_translation({ db, key_id: 'misc.add', locale: 'es', value: 'Agregar', source: 'ai', needs_review: 'ai' })
    const response = await call({ token: await token_for(TRANSLATOR), body: { key_id: 'misc.add', locale: 'es' } })
    const { row } = await response.json() as TranslateApproveResponse
    expect(row.needs_review).toBeNull()
    expect(row.source).toBe('human')
    expect(row.value).toBe('Agregar') // value untouched
    expect(row.updated_by_name).toBe('Tina')
  })
})
