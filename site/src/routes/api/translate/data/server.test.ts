import type { TranslateDataResponse } from './+server'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { ADMIN, make_cookies, seed_translate, STRANGER, token_for, TRANSLATOR } from '../_test-helpers'
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

function call(options: { token?: string, locale: string }) {
  const url = new URL(`http://localhost/api/translate/data?locale=${options.locale}`)
  return GET({ url, request: new Request(url), cookies: make_cookies(options.token) } as unknown as Parameters<typeof GET>[0])
}

describe(GET, () => {
  test('401 without auth', async () => {
    await expect(call({ locale: 'es' })).rejects.toMatchObject({ status: 401 })
  })

  test('403 for a user with no assignments', async () => {
    await expect(call({ token: await token_for(STRANGER), locale: 'es' }))
      .rejects.toMatchObject({ status: 403 })
  })

  test('403 for a locale outside the translator\'s assignments', async () => {
    await expect(call({ token: await token_for(TRANSLATOR), locale: 'ru' }))
      .rejects.toMatchObject({ status: 403 })
  })

  test('translator gets the full catalog for an assigned locale', async () => {
    const response = await call({ token: await token_for(TRANSLATOR), locale: 'es' })
    const { locale, rows } = await response.json() as TranslateDataResponse
    expect(locale).toBe('es')
    // eslint-disable-next-line no-restricted-syntax -- catalog size grows as keys are added
    expect(rows.length).toBeGreaterThan(900)
    const row = rows.find(entry => entry.key_id === 'misc.add')
    expect(row?.en_value).toBeTruthy()
    expect(row?.value).toBeNull() // nothing translated yet
  })

  test('admin can open any locale', async () => {
    const response = await call({ token: await token_for(ADMIN), locale: 'ru' })
    const { locale } = await response.json() as TranslateDataResponse
    expect(locale).toBe('ru')
  })
})
