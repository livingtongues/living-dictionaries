import type { ChatMessageWithAttachments } from '$lib/server/chat/chat-db'
import type { RequestHandler } from './$types'
import { gate_chat, throw_chat_error } from '$lib/server/chat/api'
import { attach_attachments, edit_message } from '$lib/server/chat/chat-db'
import { ResponseCodes } from '$lib/constants'
import { error, json } from '@sveltejs/kit'

export interface AdminChatEditRequestBody {
  message_id: string
  body_html: string
  body_text: string
}

export interface AdminChatEditResponse {
  message: ChatMessageWithAttachments
}

export const POST: RequestHandler = async (event) => {
  const { db, user_id } = await gate_chat(event)
  const body = await event.request.json() as AdminChatEditRequestBody
  if (!body.message_id)
    error(ResponseCodes.BAD_REQUEST, 'message_id required')
  try {
    const edited = edit_message({ db, message_id: body.message_id, user_id, body_html: body.body_html ?? '', body_text: body.body_text ?? '' })
    const [message] = attach_attachments({ db, messages: [edited] })
    return json({ message } satisfies AdminChatEditResponse)
  } catch (err) {
    throw_chat_error(err)
  }
}
