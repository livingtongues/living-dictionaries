import type { RequestHandler } from './$types'
import type { DictionaryCoordinates } from '$lib/db/schemas/shared.types'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { parse_row } from '$lib/db/schemas/json-columns'
import { log_server_event } from '$lib/server/log-server-event'
import { send_dictionary_emails } from '$api/email/new_dictionary/dictionary-emails'
import { error, json } from '@sveltejs/kit'

/**
 * Create a new dictionary. The caller becomes its `manager`.
 *
 * Inserts a `dictionaries` catalog row + a creator `dictionary_roles` row in a
 * single transaction against shared.db (`dirty = 1` so the admin.db engine
 * pulls it down on next sync). `id` doubles as the URL slug; it must be unique.
 * Returns the new id so the page can redirect to `/{id}`.
 */
export interface DictionariesCreateRequestBody {
  id: string
  url?: string
  name: string
  gloss_languages: string[]
  alternate_names?: string[]
  location?: string | null
  coordinates?: DictionaryCoordinates | null
  iso_639_3?: string | null
  glottocode?: string | null
  community_permission?: string | null
  author_connection?: string | null
  con_language_description?: string | null
}

export interface DictionariesCreateResponseBody {
  id: string
}

const MIN_URL_LENGTH = 3
const ID_PATTERN = /^[a-z0-9-]+$/

export const POST: RequestHandler = async (event) => {
  const { user_id, email } = await verify_auth(event)

  const body = await event.request.json() as DictionariesCreateRequestBody

  const id = (body.id || '').trim().toLowerCase()
  const name = (body.name || '').trim()

  if (id.length < MIN_URL_LENGTH)
    error(ResponseCodes.BAD_REQUEST, `URL must be at least ${MIN_URL_LENGTH} characters`)
  if (!ID_PATTERN.test(id))
    error(ResponseCodes.BAD_REQUEST, 'URL may only contain lowercase letters, numbers, and hyphens')
  if (!name)
    error(ResponseCodes.BAD_REQUEST, 'Name is required')
  if (!Array.isArray(body.gloss_languages) || body.gloss_languages.length === 0)
    error(ResponseCodes.BAD_REQUEST, 'At least one glossing language is required')

  const db = get_shared_db()

  const existing = db.prepare('SELECT id FROM dictionaries WHERE id = ? OR url = ?').get(id, id)
  if (existing)
    error(ResponseCodes.CONFLICT, 'A dictionary with this URL already exists')

  const now = new Date().toISOString()
  const role_id = crypto.randomUUID()

  const create = db.transaction(() => {
    db.prepare(`
      INSERT INTO dictionaries (
        id, url, name, gloss_languages, alternate_names, location, coordinates,
        iso_639_3, glottocode, community_permission, author_connection,
        con_language_description, entry_count, dirty, created_at,
        created_by_user_id, updated_at, updated_by_user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?, ?)
    `).run(
      id,
      id,
      name,
      JSON.stringify(body.gloss_languages),
      body.alternate_names?.length ? JSON.stringify(body.alternate_names) : null,
      body.location?.trim() || null,
      body.coordinates ? JSON.stringify(body.coordinates) : null,
      body.iso_639_3?.trim() || null,
      body.glottocode?.trim() || null,
      body.community_permission || null,
      body.author_connection?.trim() || null,
      body.con_language_description?.trim() || null,
      now,
      user_id,
      now,
      user_id,
    )

    db.prepare(`
      INSERT INTO dictionary_roles (id, dictionary_id, user_id, role, dirty, created_at, updated_at)
      VALUES (?, ?, ?, 'manager', 1, ?, ?)
    `).run(role_id, id, user_id, now, now)
  })

  try {
    create()
  } catch (err) {
    console.error(`Error creating dictionary: ${(err as Error).message}`)
    log_server_event({ db, level: 'error', message: 'dictionary_create_failed', error: err, user_id, context: { dictionary_id: id } })
    error(ResponseCodes.INTERNAL_SERVER_ERROR, 'Could not create dictionary')
  }

  log_server_event({ db, level: 'info', message: 'dictionary_created', user_id, context: { dictionary_id: id, gloss_languages: body.gloss_languages } })

  // Hydrate JSON columns (gloss_languages, alternate_names, coordinates) — the
  // raw row stores them as strings, but the email composer expects arrays/objects
  // (`gloss_languages.join(...)` threw on the unparsed string).
  const saved_dictionary = parse_row('dictionaries', db.prepare('SELECT * FROM dictionaries WHERE id = ?').get(id) as Record<string, unknown>)
  try {
    await send_dictionary_emails(saved_dictionary as any, email ?? '')
  } catch (err) {
    console.error(`Dictionary created but emails failed: ${(err as Error).message}`)
    log_server_event({ db, level: 'warn', message: 'dictionary_create_email_failed', error: err, user_id, context: { dictionary_id: id } })
  }

  return json({ id } satisfies DictionariesCreateResponseBody)
}
