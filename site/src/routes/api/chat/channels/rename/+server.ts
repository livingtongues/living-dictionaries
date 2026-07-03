import type { ChatRoom } from '$lib/server/chat/chat-db'
import type { RequestHandler } from './$types'
import { gate_chat_manage, throw_chat_error } from '$lib/server/chat/api'
import { rename_room } from '$lib/server/chat/chat-db'
import { ResponseCodes } from '$lib/constants'
import { error, json } from '@sveltejs/kit'

export interface ChatChannelsRenameRequestBody {
  room_id: string
  name: string
}

export interface ChatChannelsRenameResponse {
  room: ChatRoom
}

/** Rename a channel (member + manage rights — admin rooms need level 3). */
export const POST: RequestHandler = async (event) => {
  const body = await event.request.json() as ChatChannelsRenameRequestBody
  if (!body.room_id || !body.name?.trim())
    error(ResponseCodes.BAD_REQUEST, 'room_id and name required')
  const { db } = await gate_chat_manage(event, body.room_id)
  try {
    const room = rename_room({ db, room_id: body.room_id, name: body.name })
    return json({ room } satisfies ChatChannelsRenameResponse)
  } catch (err) {
    throw_chat_error(err)
  }
}
