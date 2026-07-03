import type { ChatDmResponse } from './+server'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { open_shared_db } from '$lib/db/server/shared-db'
import { ADMIN, make_cookies, PARTNER, seed_chat_users, seed_rooms, SUPER_ADMIN, token_for } from '../_test-helpers'
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
  seed_chat_users(db)
  seed_rooms(db)
})

afterEach(() => {
  db.close()
})

function call(options: { token?: string, user_id: string }) {
  const request = new Request('http://localhost/api/chat/dm', {
    method: 'POST',
    body: JSON.stringify({ user_id: options.user_id }),
    headers: { 'content-type': 'application/json' },
  })
  return POST({ request, cookies: make_cookies(options.token) } as unknown as Parameters<typeof POST>[0])
}

describe(POST, () => {
  test('partner can DM a co-member', async () => {
    const response = await call({ token: await token_for(PARTNER), user_id: SUPER_ADMIN.user_id })
    const { room_id } = await response.json() as ChatDmResponse
    expect(room_id).toContain('dm:')
  })

  test('403 when the target shares no room with the caller', async () => {
    // Greg is only in the admin room + system rooms — no overlap with the partner.
    await expect(call({ token: await token_for(PARTNER), user_id: ADMIN.user_id }))
      .rejects.toMatchObject({ status: 403 })
  })
})
