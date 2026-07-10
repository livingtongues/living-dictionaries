import type { RequestHandler } from './$types'
import type { PartnerWithPhoto } from '$lib/types'
import { verify_auth_dict_role } from '$lib/auth/verify-dict-role'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { log_server_event } from '$lib/server/log-server-event'
import { error, json } from '@sveltejs/kit'

/**
 * Public read of a dictionary's partner organizations (about page, contributors
 * tab, print/PDF citation). The logo is denormalized on the row.
 */
export const GET: RequestHandler = (event) => {
  const dict_id = event.params.id
  if (!dict_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing dictionary id')

  const db = get_shared_db()
  const rows = db.prepare(`
    SELECT id, name, photo_serving_url, photo_storage_path
    FROM dictionary_partners
    WHERE dictionary_id = ?
    ORDER BY created_at ASC
  `).all(dict_id) as { id: string, name: string, photo_serving_url: string | null, photo_storage_path: string | null }[]

  const partners: PartnerWithPhoto[] = rows.map(row => ({
    id: row.id,
    name: row.name,
    photo: row.photo_serving_url
      ? { id: row.id, storage_path: row.photo_storage_path ?? '', serving_url: row.photo_serving_url }
      : undefined,
  })) as PartnerWithPhoto[]

  return json({ partners })
}

/**
 * Manager-scoped CRUD for `dictionary_partners` (the partner organizations
 * shown on a dictionary's contributors tab). Site admins bypass via
 * `verify_auth_dict_role`. Writes directly to shared.db with `dirty = 1` so the
 * admin.db sync engine pulls the change — managers have no local mirror, so the
 * contributors `+page.server.ts` re-reads on `invalidate`.
 *
 * The logo (`photo_serving_url` / `photo_storage_path`) is denormalized onto the
 * partner row — there's no separate photos table. The image upload itself runs
 * client-side; this endpoint only records the resulting paths.
 *
 * One POST, discriminated by `action`:
 *   - `add`          → INSERT a partner by name
 *   - `delete`       → DELETE a partner
 *   - `set_photo`    → set the partner's logo serving_url + storage_path
 *   - `remove_photo` → clear the partner's logo
 */

interface AddPartnerBody {
  action: 'add'
  name: string
}
interface DeletePartnerBody {
  action: 'delete'
  partner_id: string
}
interface SetPhotoBody {
  action: 'set_photo'
  partner_id: string
  photo_serving_url: string
  photo_storage_path: string
}
interface RemovePhotoBody {
  action: 'remove_photo'
  partner_id: string
}

export type DictionariesIdPartnersRequestBody
  = | AddPartnerBody
    | DeletePartnerBody
    | SetPhotoBody
    | RemovePhotoBody

export interface DictionariesIdPartnersResponseBody {
  result: 'success'
  partner_id?: string
}

export const POST: RequestHandler = async (event) => {
  const dict_id = event.params.id
  if (!dict_id)
    error(ResponseCodes.BAD_REQUEST, 'Missing dictionary id')

  await verify_auth_dict_role(event, dict_id, 'manager')

  const body = await event.request.json() as DictionariesIdPartnersRequestBody
  const db = get_shared_db()

  const dictionary = db.prepare('SELECT id FROM dictionaries WHERE id = ?').get(dict_id)
  if (!dictionary)
    error(ResponseCodes.NOT_FOUND, 'Dictionary not found')

  const now = new Date().toISOString()

  try {
    switch (body.action) {
      case 'add': {
        const name = (body.name || '').trim()
        if (!name)
          error(ResponseCodes.BAD_REQUEST, 'name required')
        const partner_id = crypto.randomUUID()
        db.prepare(`
          INSERT INTO dictionary_partners
            (id, dictionary_id, name, dirty, created_at, updated_at)
          VALUES (?, ?, ?, 1, ?, ?)
        `).run(partner_id, dict_id, name, now, now)
        return json({ result: 'success', partner_id } satisfies DictionariesIdPartnersResponseBody)
      }
      case 'delete': {
        if (!body.partner_id)
          error(ResponseCodes.BAD_REQUEST, 'partner_id required')
        db.prepare('DELETE FROM dictionary_partners WHERE id = ? AND dictionary_id = ?')
          .run(body.partner_id, dict_id)
        return json({ result: 'success' } satisfies DictionariesIdPartnersResponseBody)
      }
      case 'set_photo': {
        if (!body.partner_id || !body.photo_serving_url || !body.photo_storage_path)
          error(ResponseCodes.BAD_REQUEST, 'partner_id, photo_serving_url and photo_storage_path required')
        db.prepare(`
          UPDATE dictionary_partners
          SET photo_serving_url = ?, photo_storage_path = ?, dirty = 1, updated_at = ?
          WHERE id = ? AND dictionary_id = ?
        `).run(body.photo_serving_url, body.photo_storage_path, now, body.partner_id, dict_id)
        return json({ result: 'success' } satisfies DictionariesIdPartnersResponseBody)
      }
      case 'remove_photo': {
        if (!body.partner_id)
          error(ResponseCodes.BAD_REQUEST, 'partner_id required')
        db.prepare(`
          UPDATE dictionary_partners
          SET photo_serving_url = NULL, photo_storage_path = NULL, dirty = 1, updated_at = ?
          WHERE id = ? AND dictionary_id = ?
        `).run(now, body.partner_id, dict_id)
        return json({ result: 'success' } satisfies DictionariesIdPartnersResponseBody)
      }
      default:
        error(ResponseCodes.BAD_REQUEST, 'Unknown action')
    }
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err)
      throw err
    console.error(`Error updating dictionary partners: ${(err as Error).message}`)
    log_server_event({ level: 'error', message: 'dictionary_partners_update_failed', error: err, context: { dictionary_id: dict_id, action: body.action } })
    error(ResponseCodes.INTERNAL_SERVER_ERROR, 'Could not update partners')
  }
}
