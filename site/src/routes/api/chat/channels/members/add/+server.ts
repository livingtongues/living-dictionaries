import type { RequestHandler } from './$types'
import { gate_chat_manage, throw_chat_error } from '$lib/server/chat/api'
import { add_room_member } from '$lib/server/chat/chat-db'
import { ResponseCodes } from '$lib/constants'
import { error, json } from '@sveltejs/kit'

export interface ChatChannelsMembersAddRequestBody {
  room_id: string
  user_id: string
}

/** Add any registered user to a channel (member + manage rights). */
export const POST: RequestHandler = async (event) => {
  const body = await event.request.json() as ChatChannelsMembersAddRequestBody
  if (!body.room_id || !body.user_id)
    error(ResponseCodes.BAD_REQUEST, 'room_id and user_id required')
  const { db } = await gate_chat_manage(event, body.room_id)
  try {
    add_room_member({ db, room_id: body.room_id, user_id: body.user_id })
    return json({ ok: true })
  } catch (err) {
    throw_chat_error(err)
  }
}
