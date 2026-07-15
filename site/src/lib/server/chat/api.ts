/**
 * Shared server helpers for the `/api/chat/*` endpoints: the chat-member auth
 * gate (verify_auth + admin OR chat_access grant OR member-of-≥1-room — partners
 * and super managers get in via the grant or by being added to a channel) and
 * the manage gate for channel administration.
 */
import type { RequestEvent } from '@sveltejs/kit'
import type Database from 'better-sqlite3'
import type { EffectiveAdminLevel } from '$lib/admins'
import type { ChatRoom } from './chat-db'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { get_effective_admin_level } from '$lib/server/effective-admin-level'
import { error } from '@sveltejs/kit'
import { can_manage_room, ChatError, get_room, is_chat_member_by_id, is_member } from './chat-db'

export interface ChatGate {
  db: Database.Database
  user_id: string
  email: string | null
  admin_level: EffectiveAdminLevel
}

export async function gate_chat(event: RequestEvent): Promise<ChatGate> {
  const { user_id, email } = await verify_auth(event)
  const db = get_shared_db()
  const admin_level = get_effective_admin_level({ db, user_id, email, cookies: event.cookies })
  // Chat member = admin (level >= 2) OR chat_access grant OR in >= 1 room.
  // Admins pass without needing a room membership.
  if (admin_level < 2 && !is_chat_member_by_id({ db, user_id }))
    error(ResponseCodes.FORBIDDEN, 'Chat members only')
  return { db, user_id, email: email ?? null, admin_level }
}

export interface ChatManageGate extends ChatGate {
  room: ChatRoom
}

/** gate_chat + the caller must be a member of `room_id` AND allowed to manage it. */
export async function gate_chat_manage(event: RequestEvent, room_id: string): Promise<ChatManageGate> {
  const gate = await gate_chat(event)
  const room = get_room({ db: gate.db, room_id })
  if (!room)
    error(ResponseCodes.NOT_FOUND, 'Room not found')
  if (!is_member({ db: gate.db, room_id, user_id: gate.user_id }))
    error(ResponseCodes.FORBIDDEN, 'Not a member of this room')
  if (!can_manage_room({ room, admin_level: gate.admin_level }))
    error(ResponseCodes.FORBIDDEN, room.admin_room ? 'Only super admins can manage this room' : 'Only admins can manage channels')
  return { ...gate, room }
}

/** Map a ChatError to a SvelteKit HTTP error; rethrow anything else. */
export function throw_chat_error(err: unknown): never {
  if (err instanceof ChatError)
    error(err.status, err.message)
  throw err
}
