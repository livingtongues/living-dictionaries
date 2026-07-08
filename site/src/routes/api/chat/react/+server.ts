import type { MessageReaction } from '$lib/server/chat/chat-db'
import type { RequestHandler } from './$types'
import { gate_chat, throw_chat_error } from '$lib/server/chat/api'
import { toggle_reaction } from '$lib/server/chat/chat-db'
import { ResponseCodes } from '$lib/constants'
import { error, json } from '@sveltejs/kit'

export interface ChatReactRequestBody {
  message_id: string
  emoji: string
}

export interface ChatReactResponse {
  reactions: MessageReaction[]
}

export const POST: RequestHandler = async (event) => {
  const { db, user_id } = await gate_chat(event)
  const body = await event.request.json() as ChatReactRequestBody
  if (!body.message_id || !body.emoji)
    error(ResponseCodes.BAD_REQUEST, 'message_id and emoji required')
  try {
    const reactions = toggle_reaction({ db, message_id: body.message_id, user_id, emoji: body.emoji })
    return json({ reactions } satisfies ChatReactResponse)
  } catch (err) {
    throw_chat_error(err)
  }
}
