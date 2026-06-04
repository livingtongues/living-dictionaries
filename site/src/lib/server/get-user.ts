import type { AuthUserData } from '$lib/auth/types'
import type { Cookies } from '@sveltejs/kit'
import type Database from 'better-sqlite3'
import { is_admin } from '$lib/admins'
import { resolve_admin_level } from './resolve-admin-level'

interface UserRow {
  id: string
  email: string | null
  name: string | null
  avatar_url: string | null
  created_at: string
  preferred_locale: string | null
  unsubscribed_from_emails: string | null
}

/**
 * Fetch the canonical user row + shape it into the `AuthUserData` payload the
 * client cares about. Mirrors house's `get_user_with_subscription` minus the
 * billing fields (LD doesn't bill).
 */
export function get_user({ db, user_id, cookies }: { db: Database.Database, user_id: string, cookies?: Pick<Cookies, 'get'> }): AuthUserData | undefined {
  const user = db.prepare(
    'SELECT id, email, name, avatar_url, created_at, preferred_locale, unsubscribed_from_emails FROM users WHERE id = ?',
  ).get(user_id) as UserRow | undefined
  if (!user)
    return undefined

  const admin_level = resolve_admin_level({ email: user.email, cookies })

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url,
    created_at: user.created_at,
    is_admin: admin_level !== null || is_admin(user.email),
    admin_level,
    preferred_locale: user.preferred_locale,
    unsubscribed_from_emails: !!user.unsubscribed_from_emails,
  }
}
