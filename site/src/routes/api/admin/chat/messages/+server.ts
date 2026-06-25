import type { ChatMessageWithAttachments } from '$lib/server/chat/chat-db'
import type { RequestHandler } from './$types'
import { gate_chat, throw_chat_error } from '$lib/server/chat/api'
import { get_room_messages, mark_read } from '$lib/server/chat/chat-db'
import { ResponseCodes } from '$lib/constants'
import { error, json } from '@sveltejs/kit'

export interface AdminChatMessagesResponse {
  messages: ChatMessageWithAttachments[]
}

export const GET: RequestHandler = async (event) => {
  const { db, user_id } = await gate_chat(event)
  const room_id = event.url.searchParams.get('room_id')
  const after = event.url.searchParams.get('after')
  if (!room_id)
    error(ResponseCodes.BAD_REQUEST, 'room_id required')
  try {
    const messages = get_room_messages({ db, room_id, user_id, after })
    // Fetching a room's messages means the caller is viewing it → mark read.
    mark_read({ db, room_id, user_id })
    return json({ messages } satisfies AdminChatMessagesResponse)
  } catch (err) {
    throw_chat_error(err)
  }
}
