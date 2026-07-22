import type { TranslateSummaryResponse } from './+server'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { upsert_translation } from '$lib/server/i18n/i18n-db'
import { ADMIN, make_cookies, seed_translate, token_for, TRANSLATOR } from '../_test-helpers'
import { GET } from './+server'

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

function call(options: { token?: string }) {
  const url = new URL('http://localhost/api/translate/summary')
  return GET({ url, request: new Request(url), cookies: make_cookies(options.token) } as unknown as Parameters<typeof GET>[0])
}

describe(GET, () => {
  test('401 without auth, 403 for a non-admin translator', async () => {
    await expect(call({})).rejects.toMatchObject({ status: 401 })
    await expect(call({ token: await token_for(TRANSLATOR) })).rejects.toMatchObject({ status: 403 })
  })

  test('admin gets locale stats + the translator roster', async () => {
    upsert_translation({ db, key_id: 'misc.add', locale: 'es', value: 'Agregar', source: 'ai', needs_review: 'ai' })
    const response = await call({ token: await token_for(ADMIN) })
    const { locales, translators } = await response.json() as TranslateSummaryResponse
    const spanish = locales.find(stat => stat.locale === 'es')
    expect(spanish?.translated).toBe(1)
    expect(spanish?.flagged).toBe(1)
    expect(spanish?.flagged_ai).toBe(1)
    expect(spanish?.flagged_en_changed).toBe(0)
    expect(translators).toEqual([{ user_id: TRANSLATOR.user_id, name: 'Tina', email: 'tina@example.com', locales: ['es', 'fr'] }])
  })
})
