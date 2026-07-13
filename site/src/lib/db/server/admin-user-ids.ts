import type Database from 'better-sqlite3'
import { ADMINS } from '$lib/admins'

/**
 * The `users.id`s of the hardcoded admin allow-list (level >= 2), resolved by
 * email. Used to exclude admin sessions from the analytics Geography area tally
 * (admins browsing skew "where visitors come from"). Super Managers (level 1,
 * via `users.roles`) are NOT admins and are kept. Cheap enough to recompute per
 * rollup / per analytics build — the allow-list is a handful of rows.
 */
export function get_admin_user_ids({ shared_db }: { shared_db: Database.Database }): Set<string> {
  const emails = ADMINS.map(admin => admin.email)
  if (emails.length === 0)
    return new Set()
  const placeholders = emails.map(() => '?').join(', ')
  const rows = shared_db.prepare(
    `SELECT id FROM users WHERE email IN (${placeholders})`,
  ).all(...emails) as { id: string }[]
  return new Set(rows.map(row => row.id))
}
