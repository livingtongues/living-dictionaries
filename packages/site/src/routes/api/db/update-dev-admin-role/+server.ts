import { error, json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { ResponseCodes } from '$lib/constants'
import { mode } from '$lib/supabase'
import { getAdminSupabaseClient } from '$lib/supabase/admin'
import { dev } from '$app/environment'

export interface UpdateDevAdminRoleRequestBody {
  role_level: number
}

export const POST: RequestHandler = async ({ request, locals: { getSession } }) => {
  const { role_level } = await request.json() as UpdateDevAdminRoleRequestBody

  if (!dev) {
    if (mode !== 'development')
      error(ResponseCodes.BAD_REQUEST, `Only works on dev`)
  }

  if (typeof role_level !== 'number')
    error(ResponseCodes.BAD_REQUEST, `Role must be a number`)

  const { data: session_data, error: _error } = await getSession()
  if (_error || !session_data?.user)
    error(ResponseCodes.UNAUTHORIZED, { message: _error.message || 'Unauthorized' })

  const admin_supabase = getAdminSupabaseClient()

  const { error: update_role_error } = await admin_supabase.auth.admin.updateUserById(
    session_data.user.id,
    { app_metadata: { admin: role_level } },
  )

  if (update_role_error)
    error(ResponseCodes.INTERNAL_SERVER_ERROR, { message: update_role_error.message })

  return json('success')
}
