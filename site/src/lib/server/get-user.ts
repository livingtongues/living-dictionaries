import type { SiteRole } from '$lib/admins'
import type { AuthUserData } from '$lib/auth/types'
import type { Cookies } from '@sveltejs/kit'
import type Database from 'better-sqlite3'
import { TRANSLATABLE_LOCALES } from '$lib/i18n/locales'
import { get_translator_locales } from '$lib/server/i18n/i18n-db'
import { resolve_admin_level } from './resolve-admin-level'

interface UserRow {
  id: string
  email: string | null
  name: string | null
  avatar_url: string | null
  created_at: string
  preferred_locale: string | null
  unsubscribed_from_emails: string | null
  roles: string | null
  chat_access: number
}

/**
 * Fetch the canonical user row + shape it into the `AuthUserData` payload the
 * client cares about. Mirrors house's `get_user_with_subscription` minus the
 * billing fields (LD doesn't bill).
 */
export function get_user({ db, user_id, cookies }: { db: Database.Database, user_id: string, cookies?: Pick<Cookies, 'get'> }): AuthUserData | undefined {
  const user = db.prepare(
    'SELECT id, email, name, avatar_url, created_at, preferred_locale, unsubscribed_from_emails, roles, chat_access FROM users WHERE id = ?',
  ).get(user_id) as UserRow | undefined
  if (!user)
    return undefined

  const roles = user.roles ? JSON.parse(user.roles) as SiteRole[] : null
  const admin_level = resolve_admin_level({ email: user.email, roles, cookies })

  // A chat member is an admin (always), anyone granted chat_access, or anyone
  // added to >= 1 room. See `is_chat_member_by_id` in chat-db.ts — same rule.
  const is_chat_member = admin_level >= 2
    || !!user.chat_access
    || !!db.prepare('SELECT 1 FROM chat_room_members WHERE user_id = ? LIMIT 1').get(user.id)

  // Admins may translate every locale; others only their assigned ones.
  const translator_locales = admin_level >= 2
    ? [...TRANSLATABLE_LOCALES] as string[]
    : get_translator_locales({ db, user_id: user.id })

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url,
    created_at: user.created_at,
    is_admin: admin_level >= 2,
    admin_level,
    is_chat_member,
    translator_locales,
    preferred_locale: user.preferred_locale,
    unsubscribed_from_emails: !!user.unsubscribed_from_emails,
  }
}
