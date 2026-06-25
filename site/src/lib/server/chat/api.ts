/**
 * Shared server helpers for the `/api/admin/chat/*` endpoints: the auth gate
 * (verify_auth + is_admin + lazy membership seeding) and the admin directory
 * (used by the client for the DM picker + author/member name resolution).
 */
import type { RequestEvent } from '@sveltejs/kit'
import type Database from 'better-sqlite3'
import { ADMINS, is_admin } from '$lib/admins'
import { verify_auth } from '$lib/auth/verify'
import { ResponseCodes } from '$lib/constants'
import { get_shared_db } from '$lib/db/server/shared-db'
import { error } from '@sveltejs/kit'
import { ChatError, ensure_my_chat_setup, online_user_ids } from './chat-db'

export interface ChatGate {
  db: Database.Database
  user_id: string
  email: string
}

export async function gate_chat(event: RequestEvent): Promise<ChatGate> {
  const { user_id, email } = await verify_auth(event)
  if (!email || !is_admin(email))
    error(ResponseCodes.FORBIDDEN, 'Admin only')
  const db = get_shared_db()
  ensure_my_chat_setup({ db, user_id, email })
  return { db, user_id, email }
}

/** Map a ChatError to a SvelteKit HTTP error; rethrow anything else. */
export function throw_chat_error(err: unknown): never {
  if (err instanceof ChatError)
    error(err.status, err.message)
  throw err
}

export interface AdminDirectoryEntry {
  user_id: string | null
  name: string
  email: string
  online: boolean
}

/** Every allow-listed admin + their resolved user_id (null if never logged in) + presence. */
export function list_admin_directory(db: Database.Database): AdminDirectoryEntry[] {
  const online = online_user_ids({ db })
  return ADMINS.map((admin) => {
    const row = db.prepare('SELECT id FROM users WHERE email = ?').get(admin.email) as { id: string } | undefined
    const user_id = row?.id ?? null
    return { user_id, name: admin.name, email: admin.email, online: user_id ? online.has(user_id) : false }
  })
}
