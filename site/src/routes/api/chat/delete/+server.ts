import type { RequestHandler } from './$types'
import { gate_chat, throw_chat_error } from '$lib/server/chat/api'
import { delete_message } from '$lib/server/chat/chat-db'
import { ResponseCodes } from '$lib/constants'
import { error, json } from '@sveltejs/kit'

export interface ChatDeleteRequestBody {
  message_id: string
}

export const POST: RequestHandler = async (event) => {
  const { db, user_id } = await gate_chat(event)
  const body = await event.request.json() as ChatDeleteRequestBody
  if (!body.message_id)
    error(ResponseCodes.BAD_REQUEST, 'message_id required')
  try {
    delete_message({ db, message_id: body.message_id, user_id })
    return json({ ok: true })
  } catch (err) {
    throw_chat_error(err)
  }
}
