import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { sign_jwt } from '$lib/auth/jwt'
import { open_logs_db } from '$lib/db/server/logs-db'
import { _reset_rate_state } from '$lib/server/insert-client-log'
import { POST } from './+server'

// Raw client logs land in logs.db (split out of shared.db 2026-07-05), so the
// endpoint's insert_client_log() defaults to get_logs_db() — mock THAT.
let db: ReturnType<typeof open_logs_db>

vi.mock('$lib/db/server/logs-db', async () => {
  const actual = await vi.importActual<typeof import('$lib/db/server/logs-db')>('$lib/db/server/logs-db')
  return {
    ...actual,
    get_logs_db: () => db,
  }
})

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

beforeEach(() => {
  db = open_logs_db(':memory:')
  _reset_rate_state()
})

afterEach(() => {
  db.close()
})

function call(body: unknown, options: { token?: string, cookie_token?: string, client_address?: string, accept_language?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (options.token)
    headers.Authorization = `Bearer ${options.token}`
  if (options.accept_language)
    headers['accept-language'] = options.accept_language
  const url = 'http://localhost/api/log'
  const request = new Request(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const cookies = {
    get: (name: string) => (name === 'session' ? options.cookie_token : undefined),
  }
  return POST({
    request,
    cookies,
    url: new URL(url),
    getClientAddress: () => options.client_address ?? '127.0.0.1',
  } as unknown as Parameters<typeof POST>[0])
}

function count_rows(): number {
  const row = db.prepare('SELECT COUNT(*) AS c FROM client_logs').get() as { c: number }
  return row.c
}

describe(POST, () => {
  test('accepts a single anonymous error and stores it', async () => {
    const response = await call({ level: 'error', message: 'boom from test' }, { client_address: '10.0.0.1' })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, accepted: 1 })
    expect(count_rows()).toBe(1)

    const row = db.prepare('SELECT user_id, level, message FROM client_logs').get() as { user_id: string | null, level: string, message: string }
    expect(row.user_id).toBeNull()
    expect(row.level).toBe('error')
    expect(row.message).toBe('boom from test')
  })

  test('stamps browser_locale from Accept-Language on every entry (null when absent)', async () => {
    await call({ entries: [{ level: 'info', message: 'one' }, { level: 'error', message: 'two' }] }, { client_address: '10.0.0.11', accept_language: 'pt-br,pt;q=0.9,en;q=0.8' })
    await call({ level: 'error', message: 'no header' }, { client_address: '10.0.0.12' })

    const rows = db.prepare('SELECT message, browser_locale FROM client_logs ORDER BY message').all() as { message: string, browser_locale: string | null }[]
    expect(rows).toEqual([
      { message: 'no header', browser_locale: null },
      { message: 'one', browser_locale: 'pt-BR' },
      { message: 'two', browser_locale: 'pt-BR' },
    ])
  })

  test('accepts a batch of entries', async () => {
    const response = await call({
      entries: [
        { level: 'error', message: 'a' },
        { level: 'unhandled_rejection', message: 'b' },
        { level: 'crash', message: 'c' },
      ],
    }, { client_address: '10.0.0.2' })
    const body = await response.json()
    expect(body.accepted).toBe(3)
    expect(count_rows()).toBe(3)
  })

  test('attributes user_id from a valid Bearer token', async () => {
    const token = await sign_jwt({ sub: 'user-42', email: 'a@b.com' })
    const response = await call({ level: 'error', message: 'attributed' }, { token, client_address: '10.0.0.3' })
    const body = await response.json()
    expect(body.accepted).toBe(1)

    const row = db.prepare('SELECT user_id FROM client_logs').get() as { user_id: string }
    expect(row.user_id).toBe('user-42')
  })

  test('attributes user_id from session cookie (beacon path)', async () => {
    // Beacons send the httpOnly session cookie automatically — no URL-token hack.
    const token = await sign_jwt({ sub: 'beacon-user' })
    const response = await call({ level: 'crash', message: 'beacon' }, { cookie_token: token, client_address: '10.0.0.4' })
    const body = await response.json()
    expect(body.accepted).toBe(1)

    const row = db.prepare('SELECT user_id FROM client_logs').get() as { user_id: string }
    expect(row.user_id).toBe('beacon-user')
  })

  test('keeps log anonymous when token is invalid (does NOT 401)', async () => {
    const response = await call({ level: 'error', message: 'still saved' }, { token: 'not-a-real-token', client_address: '10.0.0.5' })
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.accepted).toBe(1)

    const row = db.prepare('SELECT user_id FROM client_logs').get() as { user_id: string | null }
    expect(row.user_id).toBeNull()
  })

  test('drops malformed entries without throwing', async () => {
    const response = await call({
      entries: [
        { level: 'error', message: 'good' },
        { level: 'fatal', message: 'bad-level' },
        { message: 'no-level' },
        { level: 'warn' },
      ],
    }, { client_address: '10.0.0.6' })
    const body = await response.json()
    expect(body.accepted).toBe(1)
    expect(count_rows()).toBe(1)
  })

  test('caps batch size at 50 entries', async () => {
    const huge = {
      entries: Array.from({ length: 200 }, (_, index) => ({
        level: 'info' as const,
        message: `entry-${index}`,
      })),
    }
    const response = await call(huge, { client_address: '10.0.0.7' })
    const body = await response.json()
    expect(body.accepted).toBe(50)
    expect(count_rows()).toBe(50)
  })

  test('rate-limits an IP after a burst of requests', async () => {
    const ip = '10.0.0.99'
    let last_response: Response | null = null
    for (let index = 0; index < 50; index++)
      last_response = await call({ level: 'error', message: `flood-${index}` }, { client_address: ip })

    const final = await (last_response as Response).json()
    expect(final.rate_limited).toBeTruthy()
    expect(final.accepted).toBe(0)
  })

  test('malformed JSON body returns 200 with accepted=0', async () => {
    const request = new Request('http://localhost/api/log', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    })
    const response = await POST({
      request,
      url: new URL('http://localhost/api/log'),
      getClientAddress: () => '10.0.0.10',
    } as unknown as Parameters<typeof POST>[0])
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, accepted: 0 })
  })
})
