import type { EffectiveAdminLevel, SiteRole } from '$lib/admins'
import type { Cookies } from '@sveltejs/kit'
import type Database from 'better-sqlite3'
import { resolve_admin_level } from './resolve-admin-level'

/**
 * Effective admin level (0-3) for a request: the `$lib/admins.ts` allow-list
 * by email (levels 2/3) plus the `users.roles` DB column (super_manager →
 * level 1). Prefer `user_id` (JWT `sub`) for the row lookup; falls back to
 * the unique `users.email`.
 */
export function get_effective_admin_level({ db, user_id, email, cookies }: {
  db: Database.Database
  user_id?: string
  email: string | null | undefined
  cookies?: Pick<Cookies, 'get'>
}): EffectiveAdminLevel {
  const row = user_id
    ? db.prepare('SELECT roles FROM users WHERE id = ?').get(user_id) as { roles: string | null } | undefined
    : email
      ? db.prepare('SELECT roles FROM users WHERE email = ?').get(email) as { roles: string | null } | undefined
      : undefined
  const roles = row?.roles ? JSON.parse(row.roles) as SiteRole[] : null
  return resolve_admin_level({ email, roles, cookies })
}
