import type { RequestHandler } from './$types'
import { gate_chat_manage, throw_chat_error } from '$lib/server/chat/api'
import { delete_room } from '$lib/server/chat/chat-db'
import { delete_attachment } from '$lib/r2/delete-attachment'
import { ResponseCodes } from '$lib/constants'
import { error, json } from '@sveltejs/kit'

export interface ChatChannelsDeleteRequestBody {
  room_id: string
}

/** Delete a channel + its messages/attachments. System rooms are refused. */
export const POST: RequestHandler = async (event) => {
  const body = await event.request.json() as ChatChannelsDeleteRequestBody
  if (!body.room_id)
    error(ResponseCodes.BAD_REQUEST, 'room_id required')
  const { db } = await gate_chat_manage(event, body.room_id)
  try {
    const { storage_keys } = delete_room({ db, room_id: body.room_id })
    // Best-effort R2 blob cleanup AFTER the DB rows are gone — an R2 hiccup
    // must not resurrect the room; orphaned blobs are harmless.
    void Promise.allSettled(storage_keys.map(storage_key => delete_attachment({ storage_key })))
    return json({ ok: true })
  } catch (err) {
    throw_chat_error(err)
  }
}
