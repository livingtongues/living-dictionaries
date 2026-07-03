import type { RequestHandler } from './$types'
import { gate_chat } from '$lib/server/chat/api'
import { mark_read } from '$lib/server/chat/chat-db'
import { ResponseCodes } from '$lib/constants'
import { error, json } from '@sveltejs/kit'

export interface ChatReadRequestBody {
  room_id: string
}

export const POST: RequestHandler = async (event) => {
  const { db, user_id } = await gate_chat(event)
  const body = await event.request.json() as ChatReadRequestBody
  if (!body.room_id)
    error(ResponseCodes.BAD_REQUEST, 'room_id required')
  mark_read({ db, room_id: body.room_id, user_id })
  return json({ ok: true })
}
