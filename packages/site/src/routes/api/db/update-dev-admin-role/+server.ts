import { firebaseConfig } from 'sveltefirets'
import { error, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { ResponseCodes } from '$lib/constants'
import { decodeToken, getDb } from '$lib/server/firebase-admin'

export interface UpdateDevAdminRoleRequestBody {
  role: number
  auth_token: string
}

export const POST: RequestHandler = async ({ request }) => {
  const { role, auth_token } = await request.json() as UpdateDevAdminRoleRequestBody

  if (firebaseConfig.projectId !== 'talking-dictionaries-dev')
    error(ResponseCodes.BAD_REQUEST, `Only works on dev`)

  if (typeof role !== 'number')
    error(ResponseCodes.BAD_REQUEST, `Role must be a number`)

  console.info({ role })
  const db = getDb()
  const decodedToken = await decodeToken(auth_token)
  if (!decodedToken?.uid)
    throw new Error('No user id found in token')

  await db.doc(`users/${decodedToken.uid}`).update({
    roles: {
      admin: role,
    },
  })

  return json('success')
}
