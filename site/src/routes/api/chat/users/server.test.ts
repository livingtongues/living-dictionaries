import type { ChatUsersResponse } from './+server'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { open_shared_db } from '$lib/db/server/shared-db'
import { ADMIN, make_cookies, PARTNER, seed_chat_users, seed_rooms, token_for } from '../_test-helpers'
import { GET } from './+server'

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
  seed_chat_users(db)
  seed_rooms(db)
})

afterEach(() => {
  db.close()
})

function call(options: { token?: string, query: string }) {
  const request = new Request(`http://localhost/api/chat/users?q=${encodeURIComponent(options.query)}`)
  return GET({ request, cookies: make_cookies(options.token), url: new URL(request.url) } as unknown as Parameters<typeof GET>[0])
}

describe(GET, () => {
  test('403 for a non-admin member (no user-base enumeration)', async () => {
    await expect(call({ token: await token_for(PARTNER), query: 'stranger' }))
      .rejects.toMatchObject({ status: 403 })
  })

  test('admin searches by name or email; short queries return nothing', async () => {
    const by_name = await (await call({ token: await token_for(ADMIN), query: 'stran' })).json() as ChatUsersResponse
    expect(by_name.users.map(user => user.email)).toEqual(['stranger@example.com'])
    const by_email = await (await call({ token: await token_for(ADMIN), query: 'partner@example' })).json() as ChatUsersResponse
    expect(by_email.users.map(user => user.user_id)).toEqual(['u-partner'])
    const short = await (await call({ token: await token_for(ADMIN), query: 'a' })).json() as ChatUsersResponse
    expect(short.users).toEqual([])
  })
})
