/**
 * Shared seeding for /api/chat endpoint tests. Each test file still declares
 * its own `vi.mock('$lib/db/server/shared-db')` (hoisting is per-file); these
 * helpers just build the common cast + rooms.
 *
 * Cast: a super admin (Jacob, level 3), an admin (Greg, level 2), and a
 * non-admin partner — the three tiers the chat gates distinguish.
 */
import type Database from 'better-sqlite3'
import { sign_jwt } from '$lib/auth/jwt'
import { add_room_member, create_channel } from '$lib/server/chat/chat-db'

export const SUPER_ADMIN = { user_id: 'u-jacob', email: 'jwrunner7@gmail.com', name: 'Jacob' }
export const ADMIN = { user_id: 'u-greg', email: 'livingtongues@gmail.com', name: 'Greg' }
export const PARTNER = { user_id: 'u-partner', email: 'partner@example.com', name: 'Pat Partner' }
export const STRANGER = { user_id: 'u-stranger', email: 'stranger@example.com', name: 'Sam Stranger' }

export function seed_chat_users(db: Database.Database): void {
  const now = '2026-01-01T00:00:00Z'
  const insert = db.prepare('INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, \'[]\', ?, ?)')
  for (const person of [SUPER_ADMIN, ADMIN, PARTNER, STRANGER])
    insert.run(person.user_id, person.email, person.name, now, now)
}

/** A regular channel with Jacob + the partner; and an admin room with Jacob + Greg. */
export function seed_rooms(db: Database.Database): { regular_id: string, admin_room_id: string } {
  const regular = create_channel({ db, name: 'Project room', created_by_user_id: SUPER_ADMIN.user_id })
  add_room_member({ db, room_id: regular.id, user_id: PARTNER.user_id })
  const admin_room = create_channel({ db, name: 'Admins only', created_by_user_id: SUPER_ADMIN.user_id, admin_room: true })
  add_room_member({ db, room_id: admin_room.id, user_id: ADMIN.user_id })
  return { regular_id: regular.id, admin_room_id: admin_room.id }
}

export function token_for(person: { user_id: string, email: string, name: string }) {
  return sign_jwt({ sub: person.user_id, email: person.email, name: person.name })
}

export function make_cookies(token: string | undefined) {
  return { get: (name: string) => (name === 'session' ? token : undefined) }
}
