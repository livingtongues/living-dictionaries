import type { ChatRoom } from '$lib/server/chat/chat-db'
import type { RequestHandler } from './$types'
import { gate_chat, throw_chat_error } from '$lib/server/chat/api'
import { create_channel } from '$lib/server/chat/chat-db'
import { ResponseCodes } from '$lib/constants'
import { error, json } from '@sveltejs/kit'

export interface ChatChannelsRequestBody {
  name: string
  /** Restrict management to super admins (level 3) — only settable by super admins. */
  admin_room?: boolean
}

export interface ChatChannelsResponse {
  room: ChatRoom
}

/** Create a channel (admins level >= 2; the creator is auto-joined). */
export const POST: RequestHandler = async (event) => {
  const { db, user_id, admin_level } = await gate_chat(event)
  if (admin_level < 2)
    error(ResponseCodes.FORBIDDEN, 'Only admins can create channels')
  const body = await event.request.json() as ChatChannelsRequestBody
  if (!body.name?.trim())
    error(ResponseCodes.BAD_REQUEST, 'name required')
  if (body.admin_room && admin_level < 3)
    error(ResponseCodes.FORBIDDEN, 'Only super admins can create admin rooms')
  try {
    const room = create_channel({ db, name: body.name, created_by_user_id: user_id, admin_room: !!body.admin_room })
    return json({ room } satisfies ChatChannelsResponse)
  } catch (err) {
    throw_chat_error(err)
  }
}
