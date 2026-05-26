import type { AuthUserData } from '$lib/auth/types'
import type Database from 'better-sqlite3'
import { get_admin_level, is_admin } from '$lib/admins'

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
export function get_user({ db, user_id }: { db: Database.Database, user_id: string }): AuthUserData | undefined {
  const user = db.prepare(
    'SELECT id, email, name, avatar_url, created_at, preferred_locale, unsubscribed_from_emails FROM users WHERE id = ?',
  ).get(user_id) as UserRow | undefined
  if (!user)
    return undefined

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url,
    created_at: user.created_at,
    is_admin: is_admin(user.email),
    admin_level: get_admin_level(user.email),
    preferred_locale: user.preferred_locale,
    unsubscribed_from_emails: !!user.unsubscribed_from_emails,
  }
}
