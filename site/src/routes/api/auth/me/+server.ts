import type { AuthUserData } from '$lib/auth/types'
import type { RequestHandler } from './$types'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { get_user } from '$lib/server/get-user'
import { error, json } from '@sveltejs/kit'

export type AuthMeResponseBody = AuthUserData

export const GET: RequestHandler = async (event) => {
  const { user_id } = await verify_auth(event)
  const db = get_shared_db()
  const user = get_user({ db, user_id })
  if (!user)
    error(ResponseCodes.NOT_FOUND, 'User not found')
  return json(user satisfies AuthMeResponseBody)
}
