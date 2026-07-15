import type { ChatMessageWithAttachments, RoomReadPosition } from '$lib/server/chat/chat-db'
import type { RequestHandler } from './$types'
import { gate_chat, throw_chat_error } from '$lib/server/chat/api'
import { get_room_messages, get_room_read_positions, mark_read } from '$lib/server/chat/chat-db'
import { ResponseCodes } from '$lib/constants'
import { error, json } from '@sveltejs/kit'

export interface ChatMessagesResponse {
  messages: ChatMessageWithAttachments[]
  /** Every member's read position, for the read-receipt bubbles. */
  read_positions: RoomReadPosition[]
}

export const GET: RequestHandler = async (event) => {
  const { db, user_id } = await gate_chat(event)
  const room_id = event.url.searchParams.get('room_id')
  const after = event.url.searchParams.get('after')
  const before = event.url.searchParams.get('before')
  if (!room_id)
    error(ResponseCodes.BAD_REQUEST, 'room_id required')
  try {
    const messages = get_room_messages({ db, room_id, user_id, after, before })
    // Fetching a room's messages means the caller is viewing it → mark read.
    // Read BEFORE marking so our own last_read_at reflects the pre-view state
    // (the client tracks its own position from the messages it now holds).
    // A `before` (load-older) fetch is history paging, not a live view — don't
    // advance the read position for it.
    const read_positions = get_room_read_positions({ db, room_id, user_id })
    if (!before)
      mark_read({ db, room_id, user_id })
    return json({ messages, read_positions } satisfies ChatMessagesResponse)
  } catch (err) {
    throw_chat_error(err)
  }
}
