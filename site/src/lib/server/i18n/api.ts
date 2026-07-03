/**
 * Auth gates for the `/api/translate/*` endpoints. Mirrors the chat gate
 * philosophy: NOT an admin-level check — a translator gets in by having ≥1
 * `translator_languages` row (each scoping which locales they may write).
 * Admins (level ≥2) are implicitly translators for every locale.
 */
import type { RequestEvent } from '@sveltejs/kit'
import type Database from 'better-sqlite3'
import type { EffectiveAdminLevel } from '$lib/admins'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { TRANSLATABLE_LOCALES } from '$lib/i18n/locales'
import { get_effective_admin_level } from '$lib/server/effective-admin-level'
import { error } from '@sveltejs/kit'
import { get_translator_locales, I18nError } from './i18n-db'

export interface TranslateGate {
  db: Database.Database
  user_id: string
  email: string | null
  name: string | null
  admin_level: EffectiveAdminLevel
  allowed_locales: string[]
}

export async function gate_translate(event: RequestEvent): Promise<TranslateGate> {
  const { user_id, email } = await verify_auth(event)
  const db = get_shared_db()
  const admin_level = get_effective_admin_level({ db, user_id, email, cookies: event.cookies })
  const allowed_locales = admin_level >= 2
    ? [...TRANSLATABLE_LOCALES]
    : get_translator_locales({ db, user_id })
  if (!allowed_locales.length)
    error(ResponseCodes.FORBIDDEN, 'Translators only')
  const row = db.prepare('SELECT name FROM users WHERE id = ?').get(user_id) as { name: string | null } | undefined
  return { db, user_id, email: email ?? null, name: row?.name ?? null, admin_level, allowed_locales }
}

/** gate_translate + the caller must be assigned the specific locale. */
export async function gate_translate_locale(event: RequestEvent, locale: string | null): Promise<TranslateGate> {
  const gate = await gate_translate(event)
  if (!locale)
    error(ResponseCodes.BAD_REQUEST, 'locale required')
  if (!gate.allowed_locales.includes(locale))
    error(ResponseCodes.FORBIDDEN, `Not a translator for ${locale}`)
  return gate
}

/** Map an I18nError to a SvelteKit HTTP error; rethrow anything else. */
export function throw_i18n_error(err: unknown): never {
  if (err instanceof I18nError)
    error(err.status, err.message)
  throw err
}
