import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { open_shared_db } from '$lib/db/server/shared-db'
import { get_room } from '$lib/server/chat/chat-db'
import { ADMIN, make_cookies, PARTNER, seed_chat_users, seed_rooms, STRANGER, SUPER_ADMIN, token_for } from '../../_test-helpers'
import { POST } from './+server'

let db: ReturnType<typeof open_shared_db>

vi.mock('$lib/db/server/shared-db', async () => {
  const actual = await vi.importActual<typeof import('$lib/db/server/shared-db')>('$lib/db/server/shared-db')
  return { ...actual, get_shared_db: () => db }
})

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

let rooms: { regular_id: string, admin_room_id: string }

beforeEach(() => {
  db = open_shared_db(':memory:')
  seed_chat_users(db)
  rooms = seed_rooms(db)
})

afterEach(() => {
  db.close()
})

function call(options: { token?: string, room_id: string }) {
  const request = new Request('http://localhost/api/chat/channels/delete', {
    method: 'POST',
    body: JSON.stringify({ room_id: options.room_id }),
    headers: { 'content-type': 'application/json' },
  })
  return POST({ request, cookies: make_cookies(options.token) } as unknown as Parameters<typeof POST>[0])
}

describe(POST, () => {
  test('403 for a non-admin member', async () => {
    await expect(call({ token: await token_for(PARTNER), room_id: rooms.regular_id }))
      .rejects.toMatchObject({ status: 403 })
  })

  test('403 for an admin who is not a member of the channel', async () => {
    // Greg (level 2) is not in the regular room — per-room privacy holds for admins.
    await expect(call({ token: await token_for(ADMIN), room_id: rooms.regular_id }))
      .rejects.toMatchObject({ status: 403 })
  })

  test('403 for a level-2 admin on an admin room; level 3 deletes it', async () => {
    await expect(call({ token: await token_for(ADMIN), room_id: rooms.admin_room_id }))
      .rejects.toMatchObject({ status: 403 })
    const response = await call({ token: await token_for(SUPER_ADMIN), room_id: rooms.admin_room_id })
    expect(response.status).toBe(200)
    expect(get_room({ db, room_id: rooms.admin_room_id })).toBeUndefined()
  })

  test('400 for system rooms even as super admin', async () => {
    await expect(call({ token: await token_for(SUPER_ADMIN), room_id: 'all-admins' }))
      .rejects.toMatchObject({ status: 400 })
  })

  test('404 for an unknown room; 403 when caller has no memberships at all', async () => {
    await expect(call({ token: await token_for(SUPER_ADMIN), room_id: 'nope' }))
      .rejects.toMatchObject({ status: 404 })
    await expect(call({ token: await token_for(STRANGER), room_id: rooms.regular_id }))
      .rejects.toMatchObject({ status: 403 })
  })
})
