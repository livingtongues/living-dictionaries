import type { TranslateSaveResponse } from './+server'
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
  const request = new Request('http://localhost/api/translate/save', {
    method: 'POST',
    body: JSON.stringify(options.body),
    headers: { 'content-type': 'application/json' },
  })
  return POST({ request, cookies: make_cookies(options.token) } as unknown as Parameters<typeof POST>[0])
}

describe(POST, () => {
  test('401 without auth', async () => {
    await expect(call({ body: { key_id: 'misc.add', locale: 'es', value: 'Agregar' } }))
      .rejects.toMatchObject({ status: 401 })
  })

  test('403 for non-translators and for unassigned locales', async () => {
    await expect(call({ token: await token_for(STRANGER), body: { key_id: 'misc.add', locale: 'es', value: 'X' } }))
      .rejects.toMatchObject({ status: 403 })
    await expect(call({ token: await token_for(TRANSLATOR), body: { key_id: 'misc.add', locale: 'ru', value: 'X' } }))
      .rejects.toMatchObject({ status: 403 })
  })

  test('404 for an unknown key', async () => {
    await expect(call({ token: await token_for(TRANSLATOR), body: { key_id: 'no.such_key', locale: 'es', value: 'X' } }))
      .rejects.toMatchObject({ status: 404 })
  })

  test('saves as human with attribution and clears an existing review flag', async () => {
    upsert_translation({ db, key_id: 'misc.add', locale: 'es', value: 'Machine guess', source: 'ai', needs_review: 'ai' })
    const response = await call({ token: await token_for(TRANSLATOR), body: { key_id: 'misc.add', locale: 'es', value: 'Agregar' } })
    const { row } = await response.json() as TranslateSaveResponse
    expect(row?.value).toBe('Agregar')
    expect(row?.source).toBe('human')
    expect(row?.needs_review).toBeNull()
    expect(row?.updated_by_name).toBe('Tina')
  })

  test('empty value deletes the translation', async () => {
    upsert_translation({ db, key_id: 'misc.add', locale: 'es', value: 'Agregar', source: 'human' })
    const response = await call({ token: await token_for(TRANSLATOR), body: { key_id: 'misc.add', locale: 'es', value: '' } })
    const { row } = await response.json() as TranslateSaveResponse
    expect(row).toBeNull()
    const remaining = db.prepare('SELECT COUNT(*) as count FROM i18n_translations WHERE key_id = ? AND locale = ?').get('misc.add', 'es') as { count: number }
    expect(remaining.count).toBe(0)
  })
})
