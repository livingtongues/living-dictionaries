import type { AuthUserData } from '$lib/auth/types'
import type { RequestHandler } from './$types'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { get_user } from '$lib/server/get-user'
import { error, json } from '@sveltejs/kit'

export interface AuthUpdateProfileRequestBody {
  /** New display name. Omit to leave unchanged. */
  name?: string
  /** Newsletter opt-out. `true` unsubscribes, `false` re-subscribes. Omit to leave unchanged. */
  unsubscribed_from_emails?: boolean
}

export type AuthUpdateProfileResponseBody = AuthUserData

const NAME_MAX_LENGTH = 80
// Reject ASCII C0 controls (U+0000..U+001F) and DEL (U+007F). Built via
// String.fromCharCode + new RegExp so this source file stays pure ASCII.
// eslint-disable-next-line regexp/no-obscure-range
const CONTROL_CHARS = new RegExp(`[${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}]`)

export const POST: RequestHandler = async (event) => {
  const { user_id } = await verify_auth(event)
  const body = await event.request.json() as AuthUpdateProfileRequestBody

  const sets: string[] = []
  const values: (string | null)[] = []

  if (body.name !== undefined) {
    if (typeof body.name !== 'string')
      error(ResponseCodes.BAD_REQUEST, 'name must be a string')
    const trimmed = body.name.trim()
    if (!trimmed)
      error(ResponseCodes.BAD_REQUEST, 'Name is required')
    if (trimmed.length > NAME_MAX_LENGTH)
      error(ResponseCodes.BAD_REQUEST, `Name must be ${NAME_MAX_LENGTH} characters or fewer`)
    if (CONTROL_CHARS.test(trimmed))
      error(ResponseCodes.BAD_REQUEST, 'Name must not contain control characters')
    sets.push('name = ?')
    values.push(trimmed)
  }

  if (body.unsubscribed_from_emails !== undefined) {
    if (typeof body.unsubscribed_from_emails !== 'boolean')
      error(ResponseCodes.BAD_REQUEST, 'unsubscribed_from_emails must be a boolean')
    sets.push('unsubscribed_from_emails = ?')
    // Column stores the opt-out timestamp (non-null = unsubscribed); NULL = subscribed.
    values.push(body.unsubscribed_from_emails ? new Date().toISOString() : null)
  }

  if (sets.length === 0)
    error(ResponseCodes.BAD_REQUEST, 'No fields to update')

  // `users` is a READONLY syncable table: admin mirrors PULL it by `updated_at`,
  // so bumping `updated_at` is what propagates the change (no `dirty` column).
  sets.push('updated_at = strftime(\'%Y-%m-%dT%H:%M:%fZ\', \'now\')')
  values.push(user_id)

  const db = get_shared_db()
  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...values)

  const user = get_user({ db, user_id, cookies: event.cookies })
  if (!user)
    error(ResponseCodes.NOT_FOUND, 'User not found after update')

  return json(user satisfies AuthUpdateProfileResponseBody)
}
