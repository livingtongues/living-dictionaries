import type { ChatRoomsResponse } from './+server'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { ADMIN, make_cookies, PARTNER, seed_chat_users, seed_rooms, STRANGER, token_for } from '../_test-helpers'
import { GET } from './+server'

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

function call(token?: string) {
  const request = new Request('http://localhost/api/chat/rooms')
  return GET({ request, cookies: make_cookies(token) } as unknown as Parameters<typeof GET>[0])
}

describe(GET, () => {
  test('401 without auth', async () => {
    await expect(call()).rejects.toMatchObject({ status: 401 })
  })

  test('403 for a signed-in user with no memberships', async () => {
    await expect(call(await token_for(STRANGER))).rejects.toMatchObject({ status: 403 })
  })

  test('partner sees only their room + a directory scoped to co-members', async () => {
    const response = await call(await token_for(PARTNER))
    const body = await response.json() as ChatRoomsResponse
    expect(body.me).toEqual({ user_id: PARTNER.user_id, admin_level: 0 })
    expect(body.rooms.map(room => room.id)).toEqual([rooms.regular_id])
    expect(body.rooms[0].can_manage).toBeFalsy()
    // Directory = self + Jacob (shares the regular room). Greg + stranger invisible.
    expect(body.directory.map(entry => entry.user_id).sort()).toEqual(['u-jacob', 'u-partner'])
  })

  test('admin (level 2) is auto-joined to the system rooms and cannot manage the admin room', async () => {
    const response = await call(await token_for(ADMIN))
    const body = await response.json() as ChatRoomsResponse
    expect(body.me.admin_level).toBe(2)
    const ids = body.rooms.map(room => room.id)
    expect(ids).toContain('all-admins')
    expect(ids).toContain('notifications')
    const admin_room = body.rooms.find(room => room.id === rooms.admin_room_id)
    expect(admin_room?.admin_room).toBeTruthy()
    expect(admin_room?.can_manage).toBeFalsy() // level 3 required for admin rooms
  })
})
