import type { ChatChannelsResponse } from './+server'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import { is_member } from '$lib/server/chat/chat-db'
import { ADMIN, make_cookies, PARTNER, seed_chat_users, seed_rooms, SUPER_ADMIN, token_for } from '../_test-helpers'
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
  seed_chat_users(db)
  seed_rooms(db)
})

afterEach(() => {
  db.close()
})

function call(options: { token?: string, body: unknown }) {
  const request = new Request('http://localhost/api/chat/channels', {
    method: 'POST',
    body: JSON.stringify(options.body),
    headers: { 'content-type': 'application/json' },
  })
  return POST({ request, cookies: make_cookies(options.token) } as unknown as Parameters<typeof POST>[0])
}

describe(POST, () => {
  test('401 without auth', async () => {
    await expect(call({ body: { name: 'X' } })).rejects.toMatchObject({ status: 401 })
  })

  test('403 for a non-admin member', async () => {
    await expect(call({ token: await token_for(PARTNER), body: { name: 'X' } }))
      .rejects.toMatchObject({ status: 403 })
  })

  test('400 without a name', async () => {
    await expect(call({ token: await token_for(ADMIN), body: { name: '  ' } }))
      .rejects.toMatchObject({ status: 400 })
  })

  test('admin creates a channel and is auto-joined', async () => {
    const response = await call({ token: await token_for(ADMIN), body: { name: 'New partners' } })
    const { room } = await response.json() as ChatChannelsResponse
    expect(room.name).toBe('New partners')
    expect(room.admin_room).toBe(0)
    expect(is_member({ db, room_id: room.id, user_id: ADMIN.user_id })).toBeTruthy()
  })

  test('admin_room flag requires level 3', async () => {
    await expect(call({ token: await token_for(ADMIN), body: { name: 'X', admin_room: true } }))
      .rejects.toMatchObject({ status: 403 })
    const response = await call({ token: await token_for(SUPER_ADMIN), body: { name: 'X', admin_room: true } })
    const { room } = await response.json() as ChatChannelsResponse
    expect(room.admin_room).toBe(1)
  })
})
