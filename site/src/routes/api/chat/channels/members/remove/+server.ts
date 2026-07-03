import type { RequestHandler } from './$types'
import { gate_chat_manage, throw_chat_error } from '$lib/server/chat/api'
import { remove_room_member } from '$lib/server/chat/chat-db'
import { ResponseCodes } from '$lib/constants'
import { error, json } from '@sveltejs/kit'

export interface ChatChannelsMembersRemoveRequestBody {
  room_id: string
  user_id: string
}

/** Remove a member from a channel (member + manage rights; the System bot is protected). */
export const POST: RequestHandler = async (event) => {
  const body = await event.request.json() as ChatChannelsMembersRemoveRequestBody
  if (!body.room_id || !body.user_id)
    error(ResponseCodes.BAD_REQUEST, 'room_id and user_id required')
  const { db } = await gate_chat_manage(event, body.room_id)
  try {
    remove_room_member({ db, room_id: body.room_id, user_id: body.user_id })
    return json({ ok: true })
  } catch (err) {
    throw_chat_error(err)
  }
}
