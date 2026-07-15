/**
 * Boot seeding for the chat: ensure the one system room (`notifications`)
 * exists so the System bot can post platform events into it and admins can add
 * members to it from the UI.
 *
 * Chat membership is NOT seeded from the admin list anymore — it's fully
 * UI-managed. Admins always pass the chat gate via their level (see
 * `gate_chat`), and the `notifications` room's members are whoever an admin
 * explicitly adds. Non-admins get in via the `chat_access` grant or a room.
 *
 * Idempotent — safe to run on every boot, on both containers.
 */
import type Database from 'better-sqlite3'
import { ROOM_NOTIFICATIONS } from '$lib/chat/constants'
import { get_shared_db, open_test_shared_db } from '$lib/db/server/shared-db'

/** Upsert the Notifications system room (idempotent). */
export function ensure_notifications_room({ db = get_shared_db() }: { db?: Database.Database } = {}): void {
  const ts = new Date().toISOString()
  db.prepare('INSERT INTO chat_rooms (id, kind, name, admin_room, created_at, updated_at) VALUES (?, \'channel\', \'Notifications\', 1, ?, ?) ON CONFLICT(id) DO NOTHING')
    .run(ROOM_NOTIFICATIONS, ts, ts)
}

if (import.meta.vitest) {
  describe(ensure_notifications_room, () => {
    it('creates the Notifications room idempotently, with no seeded members', () => {
      const db = open_test_shared_db()
      db.prepare('DELETE FROM chat_room_members').run()
      db.prepare('DELETE FROM chat_rooms').run()
      ensure_notifications_room({ db })
      ensure_notifications_room({ db }) // re-run is a no-op
      const room = db.prepare('SELECT admin_room FROM chat_rooms WHERE id = ?').get(ROOM_NOTIFICATIONS) as { admin_room: number } | undefined
      expect(room?.admin_room).toBe(1)
      const members = (db.prepare('SELECT COUNT(*) AS c FROM chat_room_members WHERE room_id = ?').get(ROOM_NOTIFICATIONS) as { c: number }).c
      expect(members).toBe(0)
    })
  })
}
