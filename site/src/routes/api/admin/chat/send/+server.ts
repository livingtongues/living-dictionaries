import type { ChatMessageRow } from '$lib/server/chat/chat-db'
import type { RequestHandler } from './$types'
import { gate_chat, throw_chat_error } from '$lib/server/chat/api'
import { post_message } from '$lib/server/chat/chat-db'
import { notify_room_message } from '$lib/server/chat/chat-notify'
import { ResponseCodes } from '$lib/constants'
import { error, json } from '@sveltejs/kit'

export interface AdminChatSendRequestBody {
  room_id: string
  body_html: string
  body_text: string
  client_message_id?: string
  /** Allow an empty body because attachments will be uploaded right after. */
  has_attachments?: boolean
}

export interface AdminChatSendResponse {
  message: ChatMessageRow
}

export const POST: RequestHandler = async (event) => {
  const { db, user_id } = await gate_chat(event)
  const body = await event.request.json() as AdminChatSendRequestBody
  if (!body.room_id)
    error(ResponseCodes.BAD_REQUEST, 'room_id required')
  try {
    const message = post_message({
      db,
      room_id: body.room_id,
      user_id,
      body_html: body.body_html ?? '',
      body_text: body.body_text ?? '',
      client_message_id: body.client_message_id,
      allow_empty: body.has_attachments,
    })
    // Fire-and-forget: apply the anti-spam policy + ping offline members.
    void notify_room_message({ db, message, base_url: event.url.origin })
    return json({ message } satisfies AdminChatSendResponse)
  } catch (err) {
    throw_chat_error(err)
  }
}
