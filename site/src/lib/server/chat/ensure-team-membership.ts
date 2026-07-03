/**
 * Boot seeding for the two SYSTEM chat rooms (`all-admins` + `notifications`):
 * upsert the rooms (admin_room = 1) and make every allow-listed admin a member,
 * so posting in "All Admins" actually reaches everyone (the notify path is
 * membership-based). Admins who've never logged in have no `users` row yet, so
 * we create a minimal one (email + name from the allow-list, empty providers) —
 * `ON CONFLICT(email) DO NOTHING` keeps it idempotent + race-safe across
 * blue/green. A later real login links the provider to this same row by email
 * (no duplicate).
 *
 * All other channels are DB rows managed entirely in the /chat UI — nothing
 * else is seeded from source.
 *
 * Idempotent — safe to run on every boot, on both containers.
 */
import type Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { ROOM_ALL_ADMINS, ROOM_NOTIFICATIONS, SYSTEM_ROOM_IDS } from '$lib/chat/constants'
import { ADMINS } from '$lib/admins'
import { get_shared_db, open_shared_db } from '$lib/db/server/shared-db'

const SYSTEM_ROOM_NAMES: Record<string, string> = {
  [ROOM_ALL_ADMINS]: 'All Admins',
  [ROOM_NOTIFICATIONS]: 'Notifications',
}

/** Upsert the two system rooms (idempotent). */
export function ensure_system_rooms(db: Database.Database): void {
  const ts = new Date().toISOString()
  const upsert = db.prepare('INSERT INTO chat_rooms (id, kind, name, admin_room, created_at, updated_at) VALUES (?, \'channel\', ?, 1, ?, ?) ON CONFLICT(id) DO NOTHING')
  for (const room_id of SYSTEM_ROOM_IDS)
    upsert.run(room_id, SYSTEM_ROOM_NAMES[room_id], ts, ts)
}

/**
 * Join a user to whichever system rooms exist (idempotent). Lazy backstop used
 * by the chat gate for admin-level callers whose row appeared between boots.
 */
export function ensure_admin_system_memberships({ db, user_id }: { db: Database.Database, user_id: string }): void {
  const ts = new Date().toISOString()
  const add_member = db.prepare('INSERT INTO chat_room_members (room_id, user_id, created_at) VALUES (?, ?, ?) ON CONFLICT(room_id, user_id) DO NOTHING')
  for (const room_id of SYSTEM_ROOM_IDS) {
    if (db.prepare('SELECT 1 FROM chat_rooms WHERE id = ?').get(room_id))
      add_member.run(room_id, user_id, ts)
  }
}

export function ensure_all_admins_in_team_chat({ db = get_shared_db() }: { db?: Database.Database } = {}): void {
  ensure_system_rooms(db)
  const now = new Date().toISOString()
  const insert_user = db.prepare('INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, \'[]\', ?, ?) ON CONFLICT(email) DO NOTHING')
  const find_user = db.prepare('SELECT id, email FROM users WHERE email = ?')

  for (const admin of ADMINS) {
    let row = find_user.get(admin.email) as { id: string, email: string } | undefined
    if (!row) {
      insert_user.run(randomUUID(), admin.email, admin.name, now, now)
      row = find_user.get(admin.email) as { id: string, email: string }
    }
    ensure_admin_system_memberships({ db, user_id: row.id })
  }
}

if (import.meta.vitest) {
  describe(ensure_all_admins_in_team_chat, () => {
    it('creates the system rooms + user rows + memberships for every admin, idempotently', () => {
      const db = open_shared_db(':memory:')
      // The squashed migration seeds the system rooms — drop them to prove the boot step recreates.
      db.prepare('DELETE FROM chat_room_members').run()
      db.prepare('DELETE FROM chat_rooms').run()
      ensure_all_admins_in_team_chat({ db })
      ensure_all_admins_in_team_chat({ db }) // re-run is a no-op
      for (const room_id of SYSTEM_ROOM_IDS) {
        const members = (db.prepare('SELECT COUNT(*) AS c FROM chat_room_members WHERE room_id = ?').get(room_id) as { c: number }).c
        expect(members).toBe(ADMINS.length)
        const room = db.prepare('SELECT admin_room FROM chat_rooms WHERE id = ?').get(room_id) as { admin_room: number }
        expect(room.admin_room).toBe(1)
      }
      const emails = ADMINS.map(admin => admin.email)
      const placeholders = emails.map(() => '?').join(',')
      const with_rows = (db.prepare(`SELECT COUNT(*) AS c FROM users WHERE email IN (${placeholders})`).get(...emails) as { c: number }).c
      expect(with_rows).toBe(ADMINS.length)
    })
  })
}
