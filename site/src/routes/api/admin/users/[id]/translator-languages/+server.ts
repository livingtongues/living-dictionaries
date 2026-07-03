import type { RequestHandler } from './$types'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { is_admin } from '$lib/admins'
import { throw_i18n_error } from '$lib/server/i18n/api'
import { add_translator_language, get_translator_locales, remove_translator_language } from '$lib/server/i18n/i18n-db'
import { error, json } from '@sveltejs/kit'

/**
 * Admin control to assign/unassign a user as translator for a locale
 * (`translator_languages`). Having ≥1 row gates /translate + shows the
 * UserMenu link; translators may only edit their assigned locales. ADMIN ONLY.
 */

export interface AdminTranslatorLanguagesRequestBody {
  locale: string
  action: 'add' | 'remove'
}

export interface AdminTranslatorLanguagesResponseBody {
  locales: string[]
}

/** Current assignments (translator_languages is server-only — never synced to admin clients). */
export const GET: RequestHandler = async (event) => {
  const user_id = event.params.id
  if (!user_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing user id')
  const { email } = await verify_auth(event)
  if (!is_admin(email))
    error(ResponseCodes.FORBIDDEN, 'Admin only')
  const db = get_shared_db()
  return json({ locales: get_translator_locales({ db, user_id }) } satisfies AdminTranslatorLanguagesResponseBody)
}

export const POST: RequestHandler = async (event) => {
  const user_id = event.params.id
  if (!user_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing user id')

  const { email } = await verify_auth(event)
  if (!is_admin(email))
    error(ResponseCodes.FORBIDDEN, 'Admin only')

  const body = await event.request.json() as AdminTranslatorLanguagesRequestBody
  if (!body.locale || !['add', 'remove'].includes(body.action))
    error(ResponseCodes.BAD_REQUEST, 'locale and action (add|remove) required')

  const db = get_shared_db()
  const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(user_id) as { id: string } | undefined
  if (!existing)
    error(ResponseCodes.NOT_FOUND, 'User not found')

  try {
    if (body.action === 'add')
      add_translator_language({ db, user_id, locale: body.locale })
    else
      remove_translator_language({ db, user_id, locale: body.locale })
  } catch (err) {
    throw_i18n_error(err)
  }
  return json({ locales: get_translator_locales({ db, user_id }) } satisfies AdminTranslatorLanguagesResponseBody)
}
