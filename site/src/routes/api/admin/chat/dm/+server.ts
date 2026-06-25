import type { RequestHandler } from './$types'
import { gate_chat, throw_chat_error } from '$lib/server/chat/api'
import { ensure_dm } from '$lib/server/chat/chat-db'
import { ResponseCodes } from '$lib/constants'
import { error, json } from '@sveltejs/kit'

export interface AdminChatDmRequestBody {
  /** The OTHER admin's user_id to open a DM with. */
  user_id: string
}

export interface AdminChatDmResponse {
  room_id: string
}

export const POST: RequestHandler = async (event) => {
  const { db, user_id } = await gate_chat(event)
  const body = await event.request.json() as AdminChatDmRequestBody
  if (!body.user_id)
    error(ResponseCodes.BAD_REQUEST, 'user_id required')
  try {
    const room_id = ensure_dm({ db, user_id, other_user_id: body.user_id })
    return json({ room_id } satisfies AdminChatDmResponse)
  } catch (err) {
    throw_chat_error(err)
  }
}
