import type { RequestHandler } from './$types'
import { gate_chat, throw_chat_error } from '$lib/server/chat/api'
import { can_dm, ensure_dm } from '$lib/server/chat/chat-db'
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
  // One circle: you can DM anyone else who's also a chat member.
  if (!can_dm({ db, user_id, other_user_id: body.user_id }))
    error(ResponseCodes.FORBIDDEN, 'You can only message other chat members')
  try {
    const room_id = ensure_dm({ db, user_id, other_user_id: body.user_id })
    return json({ room_id } satisfies ChatDmResponse)
  } catch (err) {
    throw_chat_error(err)
  }
}
