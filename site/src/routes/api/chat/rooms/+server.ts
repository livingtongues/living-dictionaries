import type { EffectiveAdminLevel } from '$lib/admins'
import type { ChatDirectoryEntry, RoomSummary } from '$lib/server/chat/chat-db'
import type { RequestHandler } from './$types'
import { gate_chat } from '$lib/server/chat/api'
import { list_chat_directory, list_my_rooms } from '$lib/server/chat/chat-db'
import { json } from '@sveltejs/kit'

export interface ChatRoomsResponse {
  rooms: RoomSummary[]
  /** Everyone sharing a room with the caller (self included) — name resolution, presence, DM picker. */
  directory: ChatDirectoryEntry[]
  me: { user_id: string, admin_level: EffectiveAdminLevel }
}

export const GET: RequestHandler = async (event) => {
  const { db, user_id, admin_level } = await gate_chat(event)
  return json({
    rooms: list_my_rooms({ db, user_id, admin_level }),
    directory: list_chat_directory({ db, user_id }),
    me: { user_id, admin_level },
  } satisfies ChatRoomsResponse)
}
