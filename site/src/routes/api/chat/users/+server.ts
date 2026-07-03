import type { RequestHandler } from './$types'
import { SYSTEM_USER_ID } from '$lib/chat/constants'
import { ResponseCodes } from '$lib/constants'
import { gate_chat } from '$lib/server/chat/api'
import { error, json } from '@sveltejs/kit'

/**
 * Registered-user search for the add-member picker. Gated to admins (level
 * >= 2) — regular chat members must not be able to enumerate the user base.
 */

export interface ChatUsersResult {
  user_id: string
  name: string | null
  email: string | null
}

export interface ChatUsersResponse {
  users: ChatUsersResult[]
}

export const GET: RequestHandler = async (event) => {
  const { db, admin_level } = await gate_chat(event)
  if (admin_level < 2)
    error(ResponseCodes.FORBIDDEN, 'Admin only')
  const query = event.url.searchParams.get('q')?.trim() ?? ''
  if (query.length < 2)
    return json({ users: [] } satisfies ChatUsersResponse)
  const like = `%${query}%`
  const users = (db.prepare(`SELECT id AS user_id, name, email FROM users
    WHERE (email LIKE ? OR name LIKE ?) AND id != ?
    ORDER BY name IS NULL, name COLLATE NOCASE, email LIMIT 20`)
    .all(like, like, SYSTEM_USER_ID)) as ChatUsersResult[]
  return json({ users } satisfies ChatUsersResponse)
}
