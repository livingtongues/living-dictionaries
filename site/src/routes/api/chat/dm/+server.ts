import type { RequestHandler } from './$types'
import { gate_chat, throw_chat_error } from '$lib/server/chat/api'
import { ensure_dm, shares_room } from '$lib/server/chat/chat-db'
import { ResponseCodes } from '$lib/constants'
import { error, json } from '@sveltejs/kit'

export interface ChatDmRequestBody {
  /** The other member's user_id to open a DM with — must share a room with the caller. */
  user_id: string
}

export interface ChatDmResponse {
  room_id: string
}

export const POST: RequestHandler = async (event) => {
  const { db, user_id } = await gate_chat(event)
  const body = await event.request.json() as ChatDmRequestBody
  if (!body.user_id)
    error(ResponseCodes.BAD_REQUEST, 'user_id required')
  // You can only DM people you share a channel with (the directory rule).
  if (!shares_room({ db, user_id, other_user_id: body.user_id }))
    error(ResponseCodes.FORBIDDEN, 'You can only message people who share a channel with you')
  try {
    const room_id = ensure_dm({ db, user_id, other_user_id: body.user_id })
    return json({ room_id } satisfies ChatDmResponse)
  } catch (err) {
    throw_chat_error(err)
  }
}
