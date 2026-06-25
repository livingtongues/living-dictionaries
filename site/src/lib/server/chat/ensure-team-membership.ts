/**
 * Make every allow-listed admin a member of the team-chat channels so posting in
 * "All Admins" actually reaches everyone (the notify path is membership-based).
 *
 * Membership is normally built lazily on an admin's first chat-API hit; this
 * boot step does it eagerly for ALL admins. Admins who've never logged in have
 * no `users` row yet, so we create a minimal one (email + name from the
 * allow-list, empty providers) — `ON CONFLICT(email) DO NOTHING` keeps it
 * idempotent + race-safe across blue/green. A later real login links the
 * provider to this same row by email (no duplicate).
 *
 * Idempotent — safe to run on every boot, on both containers.
 */
import type Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { ROOM_ALL_ADMINS } from '$lib/admin/chat/rooms'
import { ADMINS } from '$lib/admins'
import { ensure_my_chat_setup } from '$lib/server/chat/chat-db'
import { get_shared_db, open_shared_db } from '$lib/db/server/shared-db'

export function ensure_all_admins_in_team_chat({ db = get_shared_db() }: { db?: Database.Database } = {}): void {
  const now = new Date().toISOString()
  const insert_user = db.prepare('INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, \'[]\', ?, ?) ON CONFLICT(email) DO NOTHING')
  const find_user = db.prepare('SELECT id, email FROM users WHERE email = ?')

  for (const admin of ADMINS) {
    let row = find_user.get(admin.email) as { id: string, email: string } | undefined
    if (!row) {
      insert_user.run(randomUUID(), admin.email, admin.name, now, now)
      row = find_user.get(admin.email) as { id: string, email: string }
    }
    ensure_my_chat_setup({ db, user_id: row.id, email: row.email })
  }
}

if (import.meta.vitest) {
  describe(ensure_all_admins_in_team_chat, () => {
    it('creates rows + All Admins membership for every admin, idempotently', () => {
      const db = open_shared_db(':memory:')
      ensure_all_admins_in_team_chat({ db })
      ensure_all_admins_in_team_chat({ db }) // re-run is a no-op
      const members = (db.prepare('SELECT COUNT(*) AS c FROM chat_room_members WHERE room_id = ?').get(ROOM_ALL_ADMINS) as { c: number }).c
      expect(members).toBe(ADMINS.length)
      const emails = ADMINS.map(admin => admin.email)
      const placeholders = emails.map(() => '?').join(',')
      const with_rows = (db.prepare(`SELECT COUNT(*) AS c FROM users WHERE email IN (${placeholders})`).get(...emails) as { c: number }).c
      expect(with_rows).toBe(ADMINS.length)
    })
  })
}
