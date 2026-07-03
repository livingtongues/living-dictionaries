import type { RequestHandler } from './$types'
import { gate_chat } from '$lib/server/chat/api'
import { touch_presence } from '$lib/server/chat/chat-db'
import { json } from '@sveltejs/kit'

export interface ChatHeartbeatRequestBody {
  room_id?: string | null
}

export const POST: RequestHandler = async (event) => {
  const { db, user_id } = await gate_chat(event)
  const body = await event.request.json().catch(() => ({})) as ChatHeartbeatRequestBody
  touch_presence({ db, user_id, current_room_id: body.room_id ?? null })
  return json({ ok: true })
}
