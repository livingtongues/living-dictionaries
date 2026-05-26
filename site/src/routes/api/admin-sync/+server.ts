import type { SyncRequest, SyncResponse } from '$lib/db/sync/types'
import type { RequestHandler } from './$types'
import { is_admin } from '$lib/admins'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { process_sync } from '$lib/db/server/sync-helpers'
import { CLIENT_BEHIND, SERVER_BEHIND, SyncVersionError } from '$lib/db/sync/errors'
import { error, json } from '@sveltejs/kit'

export type AdminSyncRequestBody = SyncRequest
export type AdminSyncResponseBody = SyncResponse

export const POST: RequestHandler = async (event) => {
  const { user_id, email } = await verify_auth(event)
  if (!is_admin(email))
    error(ResponseCodes.FORBIDDEN, 'Admin access required')

  const body = await event.request.json() as SyncRequest
  const db = get_shared_db()

  try {
    const response = process_sync({ db, request: body, user_id })
    return json(response satisfies AdminSyncResponseBody)
  } catch (err) {
    if (err instanceof SyncVersionError) {
      if (err.code === CLIENT_BEHIND)
        error(ResponseCodes.CONFLICT, err.message)
      if (err.code === SERVER_BEHIND)
        error(ResponseCodes.SERVICE_UNAVAILABLE, err.message)
    }
    throw err
  }
}
