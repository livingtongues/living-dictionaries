/**
 * Test-only chat seeding. In production the Notifications room and its
 * allow-list-derived membership are both ensured inside `post_system_notification`
 * (at fan-out time, not at boot); tests that exercise the digest/ping paths want
 * that state up front.
 */
import type Database from 'better-sqlite3'
import { ROOM_NOTIFICATIONS } from '$lib/chat/constants'
import { ensure_notifications_members } from './chat-db'

/** Ensure the Notifications room + every allow-listed admin as a member of it. */
export function seed_admins_in_notifications(db: Database.Database): void {
  const now = new Date().toISOString()
  db.prepare('INSERT INTO chat_rooms (id, kind, name, admin_room, created_at, updated_at) VALUES (?, \'channel\', \'Notifications\', 1, ?, ?) ON CONFLICT(id) DO NOTHING')
    .run(ROOM_NOTIFICATIONS, now, now)
  ensure_notifications_members({ db })
}
