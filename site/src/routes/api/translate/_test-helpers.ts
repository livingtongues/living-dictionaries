/**
 * Shared seeding for /api/translate endpoint tests. Each test file still
 * declares its own `vi.mock('$lib/db/server/shared-db')` (hoisting is
 * per-file). Cast: an admin (implicit translator for all locales), a
 * translator assigned es + fr, and a stranger with no assignments.
 */
import type Database from 'better-sqlite3'
import { add_translator_language, sync_en_catalog } from '$lib/server/i18n/i18n-db'

export { make_cookies, token_for } from '../chat/_test-helpers'

export const ADMIN = { user_id: 'u-greg', email: 'livingtongues@gmail.com', name: 'Greg' }
export const TRANSLATOR = { user_id: 'u-tina', email: 'tina@example.com', name: 'Tina' }
export const STRANGER = { user_id: 'u-stranger', email: 'stranger@example.com', name: 'Sam Stranger' }

export function seed_translate({ db }: { db: Database.Database }): void {
  const now = '2026-01-01T00:00:00Z'
  const insert = db.prepare('INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, \'[]\', ?, ?)')
  for (const person of [ADMIN, TRANSLATOR, STRANGER])
    insert.run(person.user_id, person.email, person.name, now, now)
  sync_en_catalog({ db })
  add_translator_language({ db, user_id: TRANSLATOR.user_id, locale: 'es' })
  add_translator_language({ db, user_id: TRANSLATOR.user_id, locale: 'fr' })
}
