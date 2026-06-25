import type { AdminDirectoryEntry } from '$lib/server/chat/api'
import type { RoomSummary } from '$lib/server/chat/chat-db'
import type { RequestHandler } from './$types'
import { gate_chat, list_admin_directory } from '$lib/server/chat/api'
import { list_my_rooms } from '$lib/server/chat/chat-db'
import { json } from '@sveltejs/kit'

export interface AdminChatRoomsResponse {
  rooms: RoomSummary[]
  admins: AdminDirectoryEntry[]
  me: { user_id: string }
}

export const GET: RequestHandler = async (event) => {
  const { db, user_id } = await gate_chat(event)
  return json({
    rooms: list_my_rooms({ db, user_id }),
    admins: list_admin_directory(db),
    me: { user_id },
  } satisfies AdminChatRoomsResponse)
}
