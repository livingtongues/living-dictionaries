import type { Database } from 'better-sqlite3'
import type { Admin } from '$lib/admins'
import { ADMINS } from '$lib/admins'
import { AGENT_USER_ID } from '$lib/agent/triage/constants'
import { open_test_shared_db } from '$lib/db/server/shared-db'

/**
 * Deterministic assignment for mail addressed to an admin's own alias
 * (`jacob@livingdictionaries.app` → Jacob, `diego@` → Diego, …). Assigns the
 * thread to that admin unless someone is already assigned (a reply landing on
 * an already-routed thread never re-routes it). These threads skip LLM triage
 * entirely — directed mail needs no classification.
 *
 * Returns true when the thread ended up assigned to the admin (fresh or
 * already-held), false when the admin has no users row yet (admins are created
 * lazily on first login) or another assignee already holds the thread.
 */
export function assign_directed_thread({ db, thread_id, admin, now = new Date().toISOString() }: {
  db: Database
  thread_id: string
  admin: Admin
  now?: string
}): boolean {
  const user_row = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE LIMIT 1')
    .get(admin.email) as { id: string } | undefined
  if (!user_row)
    return false

  // RHS column references in an UPDATE read the PRE-update values, so every
  // CASE below keys off the original assigned_to_user_id.
  db.prepare(`
    UPDATE message_threads SET
      assigned_to_user_id = COALESCE(assigned_to_user_id, ?),
      assigned_at = CASE WHEN assigned_to_user_id IS NULL THEN ? ELSE assigned_at END,
      assigned_by_user_id = CASE WHEN assigned_to_user_id IS NULL THEN ? ELSE assigned_by_user_id END,
      updated_at = ?
    WHERE id = ?
  `).run(user_row.id, now, AGENT_USER_ID, now, thread_id)

  const row = db.prepare('SELECT assigned_to_user_id FROM message_threads WHERE id = ?')
    .get(thread_id) as { assigned_to_user_id: string | null } | undefined
  return row?.assigned_to_user_id === user_row.id
}

if (import.meta.vitest) {
  const [jacob, diego] = ADMINS

  function seed() {
    const db = open_test_shared_db()
    db.prepare('INSERT INTO users (id, email) VALUES (?, ?)').run('u-jacob', jacob.email)
    db.prepare('INSERT INTO users (id, email) VALUES (?, ?)').run('u-diego', diego.email)
    db.prepare(`
      INSERT INTO message_threads (id, source, from_email, last_message_at, created_at, updated_at)
      VALUES ('t1', 'email', 'someone@example.com', '2026-07-17T00:00:00Z', '2026-07-17T00:00:00Z', '2026-07-17T00:00:00Z')
    `).run()
    return db
  }

  describe(assign_directed_thread, () => {
    test('assigns an unassigned thread to the directed admin', () => {
      const db = seed()
      expect(assign_directed_thread({ db, thread_id: 't1', admin: jacob, now: '2026-07-17T01:00:00Z' })).toBe(true)
      const row = db.prepare('SELECT assigned_to_user_id, assigned_at, assigned_by_user_id FROM message_threads WHERE id = ?').get('t1') as Record<string, string>
      expect(row.assigned_to_user_id).toBe('u-jacob')
      expect(row.assigned_at).toBe('2026-07-17T01:00:00Z')
      expect(row.assigned_by_user_id).toBe(AGENT_USER_ID)
    })

    test('never re-routes an already-assigned thread', () => {
      const db = seed()
      assign_directed_thread({ db, thread_id: 't1', admin: diego })
      expect(assign_directed_thread({ db, thread_id: 't1', admin: jacob })).toBe(false)
      const row = db.prepare('SELECT assigned_to_user_id FROM message_threads WHERE id = ?').get('t1') as Record<string, string>
      expect(row.assigned_to_user_id).toBe('u-diego')
    })

    test('returns false when the admin has no users row yet', () => {
      const db = seed()
      db.prepare('DELETE FROM users WHERE id = ?').run('u-jacob')
      expect(assign_directed_thread({ db, thread_id: 't1', admin: jacob })).toBe(false)
    })
  })
}
