import type { ChatReactResponse } from './+server'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { post_message } from '$lib/server/chat/chat-db'
import { open_shared_db } from '$lib/db/server/shared-db'
import { make_cookies, PARTNER, seed_chat_users, seed_rooms, STRANGER, SUPER_ADMIN, token_for } from '../_test-helpers'
import { POST } from './+server'

let db: ReturnType<typeof open_shared_db>

vi.mock('$lib/db/server/shared-db', async () => {
  const actual = await vi.importActual<typeof import('$lib/db/server/shared-db')>('$lib/db/server/shared-db')
  return { ...actual, get_shared_db: () => db }
})

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256'
})

let regular_id: string

beforeEach(() => {
  db = open_shared_db(':memory:')
  seed_chat_users(db)
  ;({ regular_id } = seed_rooms(db))
})

afterEach(() => {
  db.close()
})

function seed_message() {
  return post_message({ db, room_id: regular_id, user_id: SUPER_ADMIN.user_id, body_html: '<p>hi</p>', body_text: 'hi' })
}

function call(options: { token?: string, message_id: string, emoji: string }) {
  const request = new Request('http://localhost/api/chat/react', {
    method: 'POST',
    body: JSON.stringify({ message_id: options.message_id, emoji: options.emoji }),
    headers: { 'content-type': 'application/json' },
  })
  return POST({ request, cookies: make_cookies(options.token) } as unknown as Parameters<typeof POST>[0])
}

describe(POST, () => {
  test('a co-member can react and toggle it off', async () => {
    const message = seed_message()
    const added = await (await call({ token: await token_for(PARTNER), message_id: message.id, emoji: '👍' })).json() as ChatReactResponse
    expect(added.reactions).toEqual([{ emoji: '👍', user_ids: [PARTNER.user_id] }])

    const removed = await (await call({ token: await token_for(PARTNER), message_id: message.id, emoji: '👍' })).json() as ChatReactResponse
    expect(removed.reactions).toEqual([])
  })

  test('two members on the same emoji aggregate into one chip', async () => {
    const message = seed_message()
    await call({ token: await token_for(PARTNER), message_id: message.id, emoji: '🎉' })
    const result = await (await call({ token: await token_for(SUPER_ADMIN), message_id: message.id, emoji: '🎉' })).json() as ChatReactResponse
    expect(result.reactions).toEqual([{ emoji: '🎉', user_ids: [PARTNER.user_id, SUPER_ADMIN.user_id] }])
  })

  test('403 when the reactor is not a member of the message room', async () => {
    const message = seed_message()
    await expect(call({ token: await token_for(STRANGER), message_id: message.id, emoji: '👍' }))
      .rejects.toMatchObject({ status: 403 })
  })

  test('400 on a missing emoji', async () => {
    const message = seed_message()
    await expect(call({ token: await token_for(PARTNER), message_id: message.id, emoji: '' }))
      .rejects.toMatchObject({ status: 400 })
  })
})
