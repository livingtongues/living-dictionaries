import type { TranslateNotifyResponse } from './+server'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { open_shared_db } from '$lib/db/server/shared-db'
import { add_translator_language } from '$lib/server/i18n/i18n-db'
import { ADMIN, make_cookies, seed_translate, token_for, TRANSLATOR } from '../_test-helpers'
import { POST } from './+server'

let db: ReturnType<typeof open_shared_db>

vi.mock('$lib/db/server/shared-db', async () => {
  const actual = await vi.importActual<typeof import('$lib/db/server/shared-db')>('$lib/db/server/shared-db')
  return { ...actual, get_shared_db: () => db }
})

const notify_user = vi.hoisted(() => vi.fn())
vi.mock('$lib/notifications/notify-admins', () => ({ notify_user }))

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

beforeEach(() => {
  notify_user.mockClear()
  db = open_shared_db(':memory:')
  seed_translate({ db })
})

afterEach(() => {
  db.close()
})

function call(options: { token?: string }) {
  const request = new Request('http://localhost/api/translate/notify', { method: 'POST', body: '{}' })
  return POST({ request, cookies: make_cookies(options.token) } as unknown as Parameters<typeof POST>[0])
}

describe(POST, () => {
  test('401 without auth, 403 for a non-admin translator', async () => {
    await expect(call({})).rejects.toMatchObject({ status: 401 })
    await expect(call({ token: await token_for(TRANSLATOR) })).rejects.toMatchObject({ status: 403 })
  })

  test('emails translators with pending work, skips those without an email', async () => {
    const now = '2026-01-01T00:00:00Z'
    db.prepare('INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, NULL, ?, \'[]\', ?, ?)')
      .run('u-no-email', 'No Email', now, now)
    add_translator_language({ db, user_id: 'u-no-email', locale: 'ru' })

    const response = await call({ token: await token_for(ADMIN) })
    const { notified, skipped } = await response.json() as TranslateNotifyResponse
    // A fresh catalog means every locale is 100% missing, so Tina has pending work.
    expect(notified).toEqual([{ email: TRANSLATOR.email, name: 'Tina', total_pending: expect.any(Number) }])
    // eslint-disable-next-line no-restricted-syntax -- catalog size grows as keys are added
    expect(notified[0].total_pending).toBeGreaterThan(1000) // es + fr both fully untranslated
    expect(skipped).toEqual([{ email: null, name: 'No Email' }])
    expect(notify_user).toHaveBeenCalledTimes(1)
    expect(notify_user.mock.calls[0][0].email).toBe(TRANSLATOR.email)
    expect(notify_user.mock.calls[0][0].email_html).toContain('/translate?locale=es&filter=pending')
  })
})
