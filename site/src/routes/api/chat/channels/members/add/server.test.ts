import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { is_member } from '$lib/server/chat/chat-db'
import { ADMIN, make_cookies, PARTNER, seed_chat_users, seed_rooms, STRANGER, SUPER_ADMIN, token_for } from '../../../_test-helpers'
import { POST } from './+server'

let db: ReturnType<typeof open_test_shared_db>

vi.mock('$lib/db/server/shared-db', async () => {
  const actual = await vi.importActual<typeof import('$lib/db/server/shared-db')>('$lib/db/server/shared-db')
  return { ...actual, get_shared_db: () => db }
})

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

let rooms: { regular_id: string, admin_room_id: string }

beforeEach(() => {
  db = open_test_shared_db()
  seed_chat_users(db)
  rooms = seed_rooms(db)
})

afterEach(() => {
  db.close()
})

function call(options: { token?: string, room_id: string, user_id: string }) {
  const request = new Request('http://localhost/api/chat/channels/members/add', {
    method: 'POST',
    body: JSON.stringify({ room_id: options.room_id, user_id: options.user_id }),
    headers: { 'content-type': 'application/json' },
  })
  return POST({ request, cookies: make_cookies(options.token) } as unknown as Parameters<typeof POST>[0])
}

describe(POST, () => {
  test('403 for a non-admin member of the room', async () => {
    await expect(call({ token: await token_for(PARTNER), room_id: rooms.regular_id, user_id: STRANGER.user_id }))
      .rejects.toMatchObject({ status: 403 })
  })

  test('managing admin adds any registered user; 404 for a ghost', async () => {
    const response = await call({ token: await token_for(SUPER_ADMIN), room_id: rooms.regular_id, user_id: STRANGER.user_id })
    expect(response.status).toBe(200)
    expect(is_member({ db, room_id: rooms.regular_id, user_id: STRANGER.user_id })).toBeTruthy()
    await expect(call({ token: await token_for(SUPER_ADMIN), room_id: rooms.regular_id, user_id: 'u-ghost' }))
      .rejects.toMatchObject({ status: 404 })
  })

  test('level-2 admin cannot manage an admin room', async () => {
    await expect(call({ token: await token_for(ADMIN), room_id: rooms.admin_room_id, user_id: STRANGER.user_id }))
      .rejects.toMatchObject({ status: 403 })
  })
})
