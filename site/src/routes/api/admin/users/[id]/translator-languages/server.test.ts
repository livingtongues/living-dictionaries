import type { AdminTranslatorLanguagesResponseBody } from './+server'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { ADMIN, make_cookies, seed_translate, token_for, TRANSLATOR } from '../../../../translate/_test-helpers'
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
  seed_translate({ db })
})

afterEach(() => {
  db.close()
})

function call(options: { token?: string, user_id: string, body: unknown }) {
  const request = new Request(`http://localhost/api/admin/users/${options.user_id}/translator-languages`, {
    method: 'POST',
    body: JSON.stringify(options.body),
    headers: { 'content-type': 'application/json' },
  })
  return POST({ request, params: { id: options.user_id }, cookies: make_cookies(options.token) } as unknown as Parameters<typeof POST>[0])
}

describe(POST, () => {
  test('401 without auth, 403 for non-admins (translators included)', async () => {
    await expect(call({ user_id: TRANSLATOR.user_id, body: { locale: 'ru', action: 'add' } }))
      .rejects.toMatchObject({ status: 401 })
    await expect(call({ token: await token_for(TRANSLATOR), user_id: TRANSLATOR.user_id, body: { locale: 'ru', action: 'add' } }))
      .rejects.toMatchObject({ status: 403 })
  })

  test('400 on bad locale or action, 404 on unknown user', async () => {
    await expect(call({ token: await token_for(ADMIN), user_id: TRANSLATOR.user_id, body: { locale: 'xx', action: 'add' } }))
      .rejects.toMatchObject({ status: 400 })
    await expect(call({ token: await token_for(ADMIN), user_id: TRANSLATOR.user_id, body: { locale: 'en', action: 'add' } }))
      .rejects.toMatchObject({ status: 400 }) // English is code-owned, never assignable
    await expect(call({ token: await token_for(ADMIN), user_id: TRANSLATOR.user_id, body: { locale: 'ru', action: 'toggle' } }))
      .rejects.toMatchObject({ status: 400 })
    await expect(call({ token: await token_for(ADMIN), user_id: 'u-ghost', body: { locale: 'ru', action: 'add' } }))
      .rejects.toMatchObject({ status: 404 })
  })

  test('admin adds and removes assignments, response reflects the new set', async () => {
    const add = await call({ token: await token_for(ADMIN), user_id: TRANSLATOR.user_id, body: { locale: 'ru', action: 'add' } })
    expect((await add.json() as AdminTranslatorLanguagesResponseBody).locales).toEqual(['es', 'fr', 'ru'])
    const remove = await call({ token: await token_for(ADMIN), user_id: TRANSLATOR.user_id, body: { locale: 'es', action: 'remove' } })
    expect((await remove.json() as AdminTranslatorLanguagesResponseBody).locales).toEqual(['fr', 'ru'])
  })
})
