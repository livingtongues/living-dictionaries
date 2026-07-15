/**
 * Test-only chat seeding. Membership is no longer boot-seeded from the admin
 * list (it's UI-managed), so tests that exercise the Notifications digest/ping
 * paths seed the admin user rows + memberships themselves via this helper.
 */
import type Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { ADMINS } from '$lib/admins'
import { ROOM_NOTIFICATIONS } from '$lib/chat/constants'
import { ensure_notifications_room } from './ensure-team-membership'

/** Ensure the Notifications room + every allow-listed admin as a member of it. */
export function seed_admins_in_notifications(db: Database.Database): void {
  ensure_notifications_room({ db })
  const now = new Date().toISOString()
  const insert_user = db.prepare('INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, \'[]\', ?, ?) ON CONFLICT(email) DO NOTHING')
  const find_user = db.prepare('SELECT id FROM users WHERE email = ?')
  const add_member = db.prepare('INSERT INTO chat_room_members (room_id, user_id, created_at) VALUES (?, ?, ?) ON CONFLICT(room_id, user_id) DO NOTHING')
  for (const admin of ADMINS) {
    insert_user.run(randomUUID(), admin.email, admin.name, now, now)
    const row = find_user.get(admin.email) as { id: string }
    add_member.run(ROOM_NOTIFICATIONS, row.id, now)
  }
}
