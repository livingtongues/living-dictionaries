/**
 * Server-authoritative data layer for the chat (/chat). All chat tables live
 * in `shared.db` and are reached ONLY through these helpers + the
 * `/api/chat/*` endpoints (never a sync sector) so per-room privacy holds.
 *
 * Channels are DB-managed rows: admins (level >= 2) create channels and manage
 * their members in the UI; rooms flagged `admin_room` are only manageable by
 * super admins (level 3). The two system rooms (`all-admins`,
 * `notifications`) are seeded + admin-joined at boot by
 * `ensure_all_admins_in_team_chat`. Raw better-sqlite3 statements — chat has
 * no JSON columns, so the auto-parse driver isn't needed.
 */
import type Database from 'better-sqlite3'
import type { EffectiveAdminLevel } from '$lib/admins'
// default-import: 'xss' is CJS — named imports break Vite dev SSR (see sanitize-rich-text.ts)
import xss from 'xss'
import { open_test_shared_db } from '$lib/db/server/shared-db'
import {
  MESSAGE_PAGE_LIMIT,
  PRESENCE_WINDOW_MS,
  SYSTEM_ROOM_IDS,
  SYSTEM_USER_ID,
} from './constants'

export type ChatRoomKind = 'channel' | 'dm'

export interface ChatRoom {
  id: string
  kind: ChatRoomKind
  name: string | null
  created_by_user_id: string | null
  admin_room: number
  created_at: string
  updated_at: string
}

export interface ChatMessageRow {
  id: string
  room_id: string
  author_user_id: string
  body_html: string
  body_text: string
  client_message_id: string | null
  created_at: string
  updated_at: string
  edited_at: string | null
  deleted_at: string | null
}

export interface ChatAttachment {
  id: string
  message_id: string
  filename: string
  mimetype: string | null
  size_bytes: number | null
  created_at: string
}

/** Aggregated reactions for one message: one entry per distinct emoji. */
export interface MessageReaction {
  emoji: string
  user_ids: string[]
}

export interface ChatMessageWithAttachments extends ChatMessageRow {
  attachments: ChatAttachment[]
  reactions: MessageReaction[]
}

/** A room member's read position (drives the read-receipt bubbles). */
export interface RoomReadPosition {
  user_id: string
  last_read_at: string | null
}

export interface RoomSummary {
  id: string
  kind: ChatRoomKind
  name: string | null
  admin_room: boolean
  /** Whether the CALLER may rename/delete/manage members (level-based; see can_manage_room). */
  can_manage: boolean
  updated_at: string
  unread: number
  last_message: ChatMessageRow | null
  member_ids: string[]
  online_member_ids: string[]
}

/** One person in the caller's chat directory (anyone sharing a room, self included). */
export interface ChatDirectoryEntry {
  user_id: string
  name: string | null
  email: string | null
  online: boolean
}

export class ChatError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function now_iso(): string {
  return new Date().toISOString()
}

/**
 * Chat bodies render via `{@html}` in every member's browser, and members now
 * include non-admin partners — sanitize at the write boundary so stored HTML
 * is always safe regardless of what a client sends.
 */
function sanitize_body_html(body_html: string): string {
  return xss(body_html)
}

/** Deterministic DM room id — the two user ids sorted so order never matters. */
export function dm_room_id(user_a: string, user_b: string): string {
  return `dm:${[user_a, user_b].sort().join(':')}`
}

/**
 * Manage gate for a room: channels only; admin rooms need a super admin
 * (level 3), regular channels an admin (level >= 2). Membership is checked
 * separately (non-members can't even see the room).
 */
export function can_manage_room({ room, admin_level }: { room: Pick<ChatRoom, 'kind' | 'admin_room'>, admin_level: EffectiveAdminLevel }): boolean {
  if (room.kind !== 'channel')
    return false
  if (room.admin_room)
    return admin_level >= 3
  return admin_level >= 2
}

/** Create a channel; the creator is auto-joined. Returns the new room. */
export function create_channel({ db, name, created_by_user_id, admin_room = false }: {
  db: Database.Database
  name: string
  created_by_user_id: string
  admin_room?: boolean
}): ChatRoom {
  const trimmed = name.trim()
  if (!trimmed)
    throw new ChatError('Channel name is required', 400)
  const id = crypto.randomUUID()
  const ts = now_iso()
  db.prepare('INSERT INTO chat_rooms (id, kind, name, created_by_user_id, admin_room, created_at, updated_at) VALUES (?, \'channel\', ?, ?, ?, ?, ?)')
    .run(id, trimmed, created_by_user_id, admin_room ? 1 : 0, ts, ts)
  db.prepare('INSERT INTO chat_room_members (room_id, user_id, created_at) VALUES (?, ?, ?)').run(id, created_by_user_id, ts)
  return get_room({ db, room_id: id }) as ChatRoom
}

export function rename_room({ db, room_id, name }: { db: Database.Database, room_id: string, name: string }): ChatRoom {
  const trimmed = name.trim()
  if (!trimmed)
    throw new ChatError('Channel name is required', 400)
  const room = get_room({ db, room_id })
  if (!room)
    throw new ChatError('Room not found', 404)
  if (room.kind !== 'channel')
    throw new ChatError('Only channels can be renamed', 400)
  db.prepare('UPDATE chat_rooms SET name = ?, updated_at = ? WHERE id = ?').run(trimmed, now_iso(), room_id)
  return get_room({ db, room_id }) as ChatRoom
}

/**
 * Hard-delete a channel: messages, attachments rows, memberships, the room.
 * Returns the deleted attachments' R2 storage keys so the caller can clean up
 * the blobs (best-effort, after responding). System rooms are refused.
 */
export function delete_room({ db, room_id }: { db: Database.Database, room_id: string }): { storage_keys: string[] } {
  const room = get_room({ db, room_id })
  if (!room)
    throw new ChatError('Room not found', 404)
  if (room.kind !== 'channel')
    throw new ChatError('Only channels can be deleted', 400)
  if ((SYSTEM_ROOM_IDS as readonly string[]).includes(room_id))
    throw new ChatError('System rooms cannot be deleted', 400)
  const storage_keys = (db.prepare('SELECT a.storage_key FROM chat_attachments a JOIN chat_messages m ON m.id = a.message_id WHERE m.room_id = ?')
    .all(room_id) as { storage_key: string }[]).map(row => row.storage_key)
  db.prepare('DELETE FROM chat_reactions WHERE message_id IN (SELECT id FROM chat_messages WHERE room_id = ?)').run(room_id)
  db.prepare('DELETE FROM chat_attachments WHERE message_id IN (SELECT id FROM chat_messages WHERE room_id = ?)').run(room_id)
  db.prepare('DELETE FROM chat_messages WHERE room_id = ?').run(room_id)
  db.prepare('DELETE FROM chat_room_members WHERE room_id = ?').run(room_id)
  db.prepare('DELETE FROM chat_rooms WHERE id = ?').run(room_id)
  return { storage_keys }
}

/** Add a registered user to a room (idempotent). */
export function add_room_member({ db, room_id, user_id }: { db: Database.Database, room_id: string, user_id: string }): void {
  if (!get_room({ db, room_id }))
    throw new ChatError('Room not found', 404)
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(user_id)
  if (!user)
    throw new ChatError('User not found', 404)
  db.prepare('INSERT INTO chat_room_members (room_id, user_id, created_at) VALUES (?, ?, ?) ON CONFLICT(room_id, user_id) DO NOTHING')
    .run(room_id, user_id, now_iso())
}

export function remove_room_member({ db, room_id, user_id }: { db: Database.Database, room_id: string, user_id: string }): void {
  // The System bot must stay in its room or platform-event posts start 403ing.
  if (user_id === SYSTEM_USER_ID)
    throw new ChatError('The System bot cannot be removed', 400)
  db.prepare('DELETE FROM chat_room_members WHERE room_id = ? AND user_id = ?').run(room_id, user_id)
}

/** The /chat access gate: does this user belong to at least one room? */
export function has_any_membership({ db, user_id }: { db: Database.Database, user_id: string }): boolean {
  return !!db.prepare('SELECT 1 FROM chat_room_members WHERE user_id = ? LIMIT 1').get(user_id)
}

/** Do two users share at least one room? (DM permission rule.) */
export function shares_room({ db, user_id, other_user_id }: { db: Database.Database, user_id: string, other_user_id: string }): boolean {
  return !!db.prepare('SELECT 1 FROM chat_room_members a JOIN chat_room_members b ON b.room_id = a.room_id WHERE a.user_id = ? AND b.user_id = ? LIMIT 1')
    .get(user_id, other_user_id)
}

/**
 * Everyone who shares a room with the caller (self included, System excluded),
 * with presence — the name-resolution directory + DM picker source. Members of
 * your channels are the only people you can see/DM.
 */
export function list_chat_directory({ db, user_id }: { db: Database.Database, user_id: string }): ChatDirectoryEntry[] {
  const rows = db.prepare(`SELECT DISTINCT u.id AS user_id, u.name, u.email
    FROM chat_room_members mine
    JOIN chat_room_members them ON them.room_id = mine.room_id
    JOIN users u ON u.id = them.user_id
    WHERE mine.user_id = ? AND them.user_id != ?
    ORDER BY u.name IS NULL, u.name COLLATE NOCASE, u.email`)
    .all(user_id, SYSTEM_USER_ID) as { user_id: string, name: string | null, email: string | null }[]
  const online = online_user_ids({ db })
  return rows.map(row => ({ ...row, online: online.has(row.user_id) }))
}

/** Create a DM room between two users (idempotent) + ensure both memberships. */
export function ensure_dm({ db, user_id, other_user_id }: { db: Database.Database, user_id: string, other_user_id: string }): string {
  if (user_id === other_user_id)
    throw new ChatError('Cannot start a DM with yourself', 400)
  const id = dm_room_id(user_id, other_user_id)
  const ts = now_iso()
  db.prepare('INSERT INTO chat_rooms (id, kind, name, created_at, updated_at) VALUES (?, \'dm\', NULL, ?, ?) ON CONFLICT(id) DO NOTHING').run(id, ts, ts)
  const add_member = db.prepare('INSERT INTO chat_room_members (room_id, user_id, created_at) VALUES (?, ?, ?) ON CONFLICT(room_id, user_id) DO NOTHING')
  add_member.run(id, user_id, ts)
  add_member.run(id, other_user_id, ts)
  return id
}

export function is_member({ db, room_id, user_id }: { db: Database.Database, room_id: string, user_id: string }): boolean {
  return !!db.prepare('SELECT 1 FROM chat_room_members WHERE room_id = ? AND user_id = ?').get(room_id, user_id)
}

function require_member({ db, room_id, user_id }: { db: Database.Database, room_id: string, user_id: string }): void {
  if (!is_member({ db, room_id, user_id }))
    throw new ChatError('Not a member of this room', 403)
}

export function get_room({ db, room_id }: { db: Database.Database, room_id: string }): ChatRoom | undefined {
  return db.prepare('SELECT * FROM chat_rooms WHERE id = ?').get(room_id) as ChatRoom | undefined
}

/**
 * Insert a message (idempotent on client_message_id). Author implicitly reads
 * up to now. `allow_empty` permits an attachment-only message (the body guard
 * is relaxed; attachments are uploaded + linked right after the insert).
 */
export function post_message({ db, room_id, user_id, body_html, body_text, client_message_id, allow_empty = false }: {
  db: Database.Database
  room_id: string
  user_id: string
  body_html: string
  body_text: string
  client_message_id?: string | null
  allow_empty?: boolean
}): ChatMessageRow {
  require_member({ db, room_id, user_id })
  if (!allow_empty && !body_text.trim() && !body_html.trim())
    throw new ChatError('Message is empty', 400)

  if (client_message_id) {
    const existing = db.prepare('SELECT * FROM chat_messages WHERE room_id = ? AND author_user_id = ? AND client_message_id = ?')
      .get(room_id, user_id, client_message_id) as ChatMessageRow | undefined
    if (existing)
      return existing
  }

  const id = crypto.randomUUID()
  const ts = now_iso()
  db.prepare('INSERT INTO chat_messages (id, room_id, author_user_id, body_html, body_text, client_message_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, room_id, user_id, sanitize_body_html(body_html), body_text, client_message_id ?? null, ts, ts)
  db.prepare('UPDATE chat_rooms SET updated_at = ? WHERE id = ?').run(ts, room_id)
  db.prepare('UPDATE chat_room_members SET last_read_at = ? WHERE room_id = ? AND user_id = ?').run(ts, room_id, user_id)
  return db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(id) as ChatMessageRow
}

/** Hydrate messages with their attachment rows in one batched query. */
export function attach_attachments({ db, messages }: { db: Database.Database, messages: ChatMessageRow[] }): ChatMessageWithAttachments[] {
  if (!messages.length)
    return []
  const ids = messages.map(message => message.id)
  const placeholders = ids.map(() => '?').join(', ')
  const rows = db.prepare(`SELECT id, message_id, filename, mimetype, size_bytes, created_at FROM chat_attachments WHERE message_id IN (${placeholders}) ORDER BY created_at ASC`)
    .all(...ids) as ChatAttachment[]
  const by_message = new Map<string, ChatAttachment[]>()
  for (const row of rows) {
    const list = by_message.get(row.message_id) ?? []
    list.push(row)
    by_message.set(row.message_id, list)
  }
  return messages.map(message => ({ ...message, attachments: by_message.get(message.id) ?? [], reactions: [] as MessageReaction[] }))
}

/** Hydrate messages with their aggregated reactions in one batched query. */
export function attach_reactions({ db, messages }: { db: Database.Database, messages: ChatMessageWithAttachments[] }): ChatMessageWithAttachments[] {
  if (!messages.length)
    return messages
  const ids = messages.map(message => message.id)
  const placeholders = ids.map(() => '?').join(', ')
  const rows = db.prepare(`SELECT message_id, emoji, user_id FROM chat_reactions WHERE message_id IN (${placeholders}) ORDER BY created_at ASC`)
    .all(...ids) as { message_id: string, emoji: string, user_id: string }[]
  // message_id → emoji → user_ids (insertion order = first-reacted-first)
  const by_message = new Map<string, Map<string, string[]>>()
  for (const row of rows) {
    let emojis = by_message.get(row.message_id)
    if (!emojis) {
      emojis = new Map()
      by_message.set(row.message_id, emojis)
    }
    const users = emojis.get(row.emoji) ?? []
    users.push(row.user_id)
    emojis.set(row.emoji, users)
  }
  for (const message of messages) {
    const emojis = by_message.get(message.id)
    message.reactions = emojis ? [...emojis.entries()].map(([emoji, user_ids]) => ({ emoji, user_ids })) : []
  }
  return messages
}

/**
 * Messages for a room, each hydrated with its attachments. With `after` (ISO) →
 * only newer rows ascending (the poll path). Otherwise the latest `limit` rows,
 * oldest-first (initial load).
 */
export function get_room_messages({ db, room_id, user_id, after, limit = MESSAGE_PAGE_LIMIT }: {
  db: Database.Database
  room_id: string
  user_id: string
  after?: string | null
  limit?: number
}): ChatMessageWithAttachments[] {
  require_member({ db, room_id, user_id })
  if (after) {
    const rows = db.prepare('SELECT * FROM chat_messages WHERE room_id = ? AND created_at > ? ORDER BY created_at ASC, id ASC LIMIT ?')
      .all(room_id, after, limit) as ChatMessageRow[]
    return attach_reactions({ db, messages: attach_attachments({ db, messages: rows }) })
  }
  const rows = db.prepare('SELECT * FROM chat_messages WHERE room_id = ? ORDER BY created_at DESC, id DESC LIMIT ?')
    .all(room_id, limit) as ChatMessageRow[]
  return attach_reactions({ db, messages: attach_attachments({ db, messages: rows.reverse() }) })
}

/** Longest emoji grapheme we accept (a few code points for ZWJ sequences / skin tones). */
const REACTION_MAX_LENGTH = 24

/**
 * Toggle the caller's reaction on a message (insert if absent, remove if
 * present). Gated on room membership. Returns the message's full aggregated
 * reaction set so the caller can update in place.
 */
export function toggle_reaction({ db, message_id, user_id, emoji }: {
  db: Database.Database
  message_id: string
  user_id: string
  emoji: string
}): MessageReaction[] {
  const trimmed = emoji.trim()
  if (!trimmed || trimmed.length > REACTION_MAX_LENGTH)
    throw new ChatError('Invalid emoji', 400)
  const message = db.prepare('SELECT room_id, deleted_at FROM chat_messages WHERE id = ?')
    .get(message_id) as { room_id: string, deleted_at: string | null } | undefined
  if (!message)
    throw new ChatError('Message not found', 404)
  if (message.deleted_at)
    throw new ChatError('Message deleted', 400)
  require_member({ db, room_id: message.room_id, user_id })
  const existing = db.prepare('SELECT id FROM chat_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?')
    .get(message_id, user_id, trimmed) as { id: string } | undefined
  if (existing)
    db.prepare('DELETE FROM chat_reactions WHERE id = ?').run(existing.id)
  else
    db.prepare('INSERT INTO chat_reactions (id, message_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(crypto.randomUUID(), message_id, user_id, trimmed, now_iso())
  const rows = db.prepare('SELECT message_id, emoji, user_id FROM chat_reactions WHERE message_id = ? ORDER BY created_at ASC')
    .all(message_id) as { message_id: string, emoji: string, user_id: string }[]
  const emojis = new Map<string, string[]>()
  for (const row of rows) {
    const users = emojis.get(row.emoji) ?? []
    users.push(row.user_id)
    emojis.set(row.emoji, users)
  }
  return [...emojis.entries()].map(([reaction_emoji, user_ids]) => ({ emoji: reaction_emoji, user_ids }))
}

/** Every member's read position for a room (drives read-receipt bubbles). Gated on membership. */
export function get_room_read_positions({ db, room_id, user_id }: {
  db: Database.Database
  room_id: string
  user_id: string
}): RoomReadPosition[] {
  require_member({ db, room_id, user_id })
  return db.prepare('SELECT user_id, last_read_at FROM chat_room_members WHERE room_id = ?')
    .all(room_id) as RoomReadPosition[]
}

export interface ChatAttachmentServeRow {
  filename: string
  mimetype: string | null
  storage_key: string
  size_bytes: number | null
  room_id: string
}

/** Look up an attachment's serve metadata, gated on the caller's room membership. */
export function get_chat_attachment_for_serve({ db, attachment_id, user_id }: { db: Database.Database, attachment_id: string, user_id: string }): ChatAttachmentServeRow {
  const row = db.prepare(`SELECT a.filename, a.mimetype, a.storage_key, a.size_bytes, m.room_id
    FROM chat_attachments a JOIN chat_messages m ON m.id = a.message_id WHERE a.id = ?`)
    .get(attachment_id) as ChatAttachmentServeRow | undefined
  if (!row)
    throw new ChatError('Attachment not found', 404)
  require_member({ db, room_id: row.room_id, user_id })
  return row
}

/** Link an uploaded R2 object to one of the caller's own messages. */
export function add_chat_attachment({ db, message_id, user_id, storage_key, filename, mimetype, size_bytes }: {
  db: Database.Database
  message_id: string
  user_id: string
  storage_key: string
  filename: string
  mimetype: string | null
  size_bytes: number | null
}): ChatAttachment {
  const message = require_own_message({ db, message_id, user_id })
  require_member({ db, room_id: message.room_id, user_id })
  const id = crypto.randomUUID()
  const ts = now_iso()
  db.prepare('INSERT INTO chat_attachments (id, message_id, storage_key, filename, mimetype, size_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, message_id, storage_key, filename, mimetype, size_bytes, ts)
  return { id, message_id, filename, mimetype, size_bytes, created_at: ts }
}

export function mark_read({ db, room_id, user_id }: { db: Database.Database, room_id: string, user_id: string }): void {
  db.prepare('UPDATE chat_room_members SET last_read_at = ? WHERE room_id = ? AND user_id = ?').run(now_iso(), room_id, user_id)
}

export function touch_presence({ db, user_id, current_room_id = null }: { db: Database.Database, user_id: string, current_room_id?: string | null }): void {
  db.prepare('INSERT INTO admin_presence (user_id, last_seen_at, current_room_id) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET last_seen_at = excluded.last_seen_at, current_room_id = excluded.current_room_id')
    .run(user_id, now_iso(), current_room_id)
}

export function online_user_ids({ db, window_ms = PRESENCE_WINDOW_MS }: { db: Database.Database, window_ms?: number }): Set<string> {
  const cutoff = new Date(Date.now() - window_ms).toISOString()
  const rows = db.prepare('SELECT user_id FROM admin_presence WHERE last_seen_at >= ?').all(cutoff) as { user_id: string }[]
  return new Set(rows.map(row => row.user_id))
}

export function list_my_rooms({ db, user_id, admin_level = 0 }: { db: Database.Database, user_id: string, admin_level?: EffectiveAdminLevel }): RoomSummary[] {
  const rooms = db.prepare('SELECT r.* FROM chat_rooms r JOIN chat_room_members m ON m.room_id = r.id WHERE m.user_id = ? ORDER BY r.updated_at DESC')
    .all(user_id) as ChatRoom[]
  const online = online_user_ids({ db })

  return rooms.map((room) => {
    const my = db.prepare('SELECT last_read_at FROM chat_room_members WHERE room_id = ? AND user_id = ?')
      .get(room.id, user_id) as { last_read_at: string | null } | undefined
    const last_read = my?.last_read_at ?? null
    const unread = (db.prepare('SELECT COUNT(*) AS count FROM chat_messages WHERE room_id = ? AND deleted_at IS NULL AND author_user_id != ? AND (? IS NULL OR created_at > ?)')
      .get(room.id, user_id, last_read, last_read) as { count: number }).count
    const last_message = db.prepare('SELECT * FROM chat_messages WHERE room_id = ? AND deleted_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 1')
      .get(room.id) as ChatMessageRow | undefined
    const member_ids = (db.prepare('SELECT user_id FROM chat_room_members WHERE room_id = ?').all(room.id) as { user_id: string }[]).map(row => row.user_id)
    return {
      id: room.id,
      kind: room.kind,
      name: room.name,
      admin_room: !!room.admin_room,
      can_manage: can_manage_room({ room, admin_level }),
      updated_at: room.updated_at,
      unread,
      last_message: last_message ?? null,
      member_ids,
      online_member_ids: member_ids.filter(member_id => online.has(member_id)),
    }
  })
}

function require_own_message({ db, message_id, user_id }: { db: Database.Database, message_id: string, user_id: string }): ChatMessageRow {
  const message = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(message_id) as ChatMessageRow | undefined
  if (!message)
    throw new ChatError('Message not found', 404)
  if (message.author_user_id !== user_id)
    throw new ChatError('Not your message', 403)
  return message
}

export function edit_message({ db, message_id, user_id, body_html, body_text }: {
  db: Database.Database
  message_id: string
  user_id: string
  body_html: string
  body_text: string
}): ChatMessageRow {
  require_own_message({ db, message_id, user_id })
  const ts = now_iso()
  db.prepare('UPDATE chat_messages SET body_html = ?, body_text = ?, edited_at = ?, updated_at = ? WHERE id = ?')
    .run(sanitize_body_html(body_html), body_text, ts, ts, message_id)
  return db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(message_id) as ChatMessageRow
}

/** Soft-delete + scrub content so the row stays for ordering but reveals nothing. */
export function delete_message({ db, message_id, user_id }: { db: Database.Database, message_id: string, user_id: string }): void {
  require_own_message({ db, message_id, user_id })
  const ts = now_iso()
  db.prepare('UPDATE chat_messages SET deleted_at = ?, body_html = \'\', body_text = \'\', updated_at = ? WHERE id = ?')
    .run(ts, ts, message_id)
}

if (import.meta.vitest) {
  function fresh_db() {
    return open_test_shared_db()
  }

  function seed_user(db: Database.Database, user_id: string, email: string | null, name = 'Someone') {
    const now = new Date().toISOString()
    db.prepare('INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, \'[]\', ?, ?)')
      .run(user_id, email, name, now, now)
  }

  /** A channel with the given members; first member is the creator. */
  function seed_channel(db: Database.Database, name: string, member_ids: string[]) {
    const room = create_channel({ db, name, created_by_user_id: member_ids[0] })
    for (const member_id of member_ids.slice(1))
      add_room_member({ db, room_id: room.id, user_id: member_id })
    return room
  }

  describe(create_channel, () => {
    it('creates a channel and auto-joins the creator', () => {
      const db = fresh_db()
      seed_user(db, 'u-jacob', 'jacob@example.com')
      const room = create_channel({ db, name: '  Partners  ', created_by_user_id: 'u-jacob' })
      expect(room.name).toBe('Partners')
      expect(room.kind).toBe('channel')
      expect(room.admin_room).toBe(0)
      expect(is_member({ db, room_id: room.id, user_id: 'u-jacob' })).toBe(true)
    })

    it('rejects an empty name and supports the admin_room flag', () => {
      const db = fresh_db()
      seed_user(db, 'u-jacob', 'jacob@example.com')
      expect(() => create_channel({ db, name: '   ', created_by_user_id: 'u-jacob' })).toThrow(ChatError)
      const admin_room = create_channel({ db, name: 'Admins only', created_by_user_id: 'u-jacob', admin_room: true })
      expect(admin_room.admin_room).toBe(1)
    })
  })

  describe(can_manage_room, () => {
    it('levels: 2 manages regular channels, 3 required for admin rooms, DMs never', () => {
      expect(can_manage_room({ room: { kind: 'channel', admin_room: 0 }, admin_level: 2 })).toBe(true)
      expect(can_manage_room({ room: { kind: 'channel', admin_room: 0 }, admin_level: 1 })).toBe(false)
      expect(can_manage_room({ room: { kind: 'channel', admin_room: 1 }, admin_level: 2 })).toBe(false)
      expect(can_manage_room({ room: { kind: 'channel', admin_room: 1 }, admin_level: 3 })).toBe(true)
      expect(can_manage_room({ room: { kind: 'dm', admin_room: 0 }, admin_level: 3 })).toBe(false)
    })
  })

  describe(add_room_member, () => {
    it('adds a registered user idempotently; unknown user/room 404', () => {
      const db = fresh_db()
      seed_user(db, 'u-a', 'a@example.com')
      seed_user(db, 'u-b', 'b@example.com')
      const room = seed_channel(db, 'General', ['u-a'])
      add_room_member({ db, room_id: room.id, user_id: 'u-b' })
      add_room_member({ db, room_id: room.id, user_id: 'u-b' })
      expect(is_member({ db, room_id: room.id, user_id: 'u-b' })).toBe(true)
      expect(() => add_room_member({ db, room_id: room.id, user_id: 'u-ghost' })).toThrow(ChatError)
      expect(() => add_room_member({ db, room_id: 'no-room', user_id: 'u-b' })).toThrow(ChatError)
    })
  })

  describe(remove_room_member, () => {
    it('removes a member but refuses to remove the System bot', () => {
      const db = fresh_db()
      seed_user(db, 'u-a', 'a@example.com')
      seed_user(db, 'u-b', 'b@example.com')
      const room = seed_channel(db, 'General', ['u-a', 'u-b'])
      remove_room_member({ db, room_id: room.id, user_id: 'u-b' })
      expect(is_member({ db, room_id: room.id, user_id: 'u-b' })).toBe(false)
      expect(() => remove_room_member({ db, room_id: room.id, user_id: SYSTEM_USER_ID })).toThrow(ChatError)
    })
  })

  describe(rename_room, () => {
    it('renames a channel and validates input', () => {
      const db = fresh_db()
      seed_user(db, 'u-a', 'a@example.com')
      const room = seed_channel(db, 'Old name', ['u-a'])
      expect(rename_room({ db, room_id: room.id, name: 'New name' }).name).toBe('New name')
      expect(() => rename_room({ db, room_id: room.id, name: ' ' })).toThrow(ChatError)
      expect(() => rename_room({ db, room_id: 'nope', name: 'x' })).toThrow(ChatError)
    })
  })

  describe(delete_room, () => {
    it('removes room + messages + attachment rows and returns storage keys', () => {
      const db = fresh_db()
      seed_user(db, 'u-a', 'a@example.com')
      const room = seed_channel(db, 'Doomed', ['u-a'])
      const message = post_message({ db, room_id: room.id, user_id: 'u-a', body_html: '', body_text: '', allow_empty: true })
      add_chat_attachment({ db, message_id: message.id, user_id: 'u-a', storage_key: 'key-1', filename: 'f.png', mimetype: 'image/png', size_bytes: 1 })
      const { storage_keys } = delete_room({ db, room_id: room.id })
      expect(storage_keys).toEqual(['key-1'])
      expect(get_room({ db, room_id: room.id })).toBeUndefined()
      expect(db.prepare('SELECT COUNT(*) AS c FROM chat_messages WHERE room_id = ?').get(room.id)).toEqual({ c: 0 })
      expect(db.prepare('SELECT COUNT(*) AS c FROM chat_room_members WHERE room_id = ?').get(room.id)).toEqual({ c: 0 })
    })

    it('refuses system rooms and DMs', () => {
      const db = fresh_db()
      // 'all-admins' is seeded by the squashed migration.
      expect(() => delete_room({ db, room_id: 'all-admins' })).toThrow(ChatError)
      const dm = ensure_dm({ db, user_id: 'u-a', other_user_id: 'u-b' })
      expect(() => delete_room({ db, room_id: dm })).toThrow(ChatError)
    })
  })

  describe(list_chat_directory, () => {
    it('returns everyone sharing a room (self included), not strangers or System', () => {
      const db = fresh_db()
      seed_user(db, 'u-a', 'a@example.com', 'Alice')
      seed_user(db, 'u-b', 'b@example.com', 'Bob')
      seed_user(db, 'u-c', 'c@example.com', 'Carol')
      seed_user(db, SYSTEM_USER_ID, null, 'System')
      const room = seed_channel(db, 'General', ['u-a', 'u-b'])
      add_room_member({ db, room_id: room.id, user_id: SYSTEM_USER_ID })
      seed_channel(db, 'Elsewhere', ['u-c'])
      const ids = list_chat_directory({ db, user_id: 'u-a' }).map(entry => entry.user_id).sort()
      expect(ids).toEqual(['u-a', 'u-b'])
    })
  })

  describe(shares_room, () => {
    it('true only for users with a common room', () => {
      const db = fresh_db()
      seed_user(db, 'u-a', 'a@example.com')
      seed_user(db, 'u-b', 'b@example.com')
      seed_user(db, 'u-c', 'c@example.com')
      seed_channel(db, 'General', ['u-a', 'u-b'])
      expect(shares_room({ db, user_id: 'u-a', other_user_id: 'u-b' })).toBe(true)
      expect(shares_room({ db, user_id: 'u-a', other_user_id: 'u-c' })).toBe(false)
    })
  })

  describe(has_any_membership, () => {
    it('flips once the user joins any room', () => {
      const db = fresh_db()
      seed_user(db, 'u-a', 'a@example.com')
      expect(has_any_membership({ db, user_id: 'u-a' })).toBe(false)
      seed_channel(db, 'General', ['u-a'])
      expect(has_any_membership({ db, user_id: 'u-a' })).toBe(true)
    })
  })

  describe(post_message, () => {
    it('is idempotent on client_message_id', () => {
      const db = fresh_db()
      seed_user(db, 'u-a', 'a@example.com')
      const room = seed_channel(db, 'General', ['u-a'])
      const first = post_message({ db, room_id: room.id, user_id: 'u-a', body_html: '<p>hi</p>', body_text: 'hi', client_message_id: 'c1' })
      const again = post_message({ db, room_id: room.id, user_id: 'u-a', body_html: '<p>hi</p>', body_text: 'hi', client_message_id: 'c1' })
      expect(again.id).toBe(first.id)
      expect(get_room_messages({ db, room_id: room.id, user_id: 'u-a' })).toHaveLength(1)
    })

    it('rejects a non-member', () => {
      const db = fresh_db()
      seed_user(db, 'u-a', 'a@example.com')
      seed_user(db, 'u-b', 'b@example.com')
      const room = seed_channel(db, 'General', ['u-a'])
      expect(() => post_message({ db, room_id: room.id, user_id: 'u-b', body_html: '<p>x</p>', body_text: 'x' })).toThrow(ChatError)
    })

    it('allows an attachment-only (empty body) message when allow_empty', () => {
      const db = fresh_db()
      seed_user(db, 'u-a', 'a@example.com')
      const room = seed_channel(db, 'General', ['u-a'])
      const message = post_message({ db, room_id: room.id, user_id: 'u-a', body_html: '', body_text: '', allow_empty: true })
      expect(message.id).toBeTruthy()
      expect(() => post_message({ db, room_id: room.id, user_id: 'u-a', body_html: '', body_text: '' })).toThrow(ChatError)
    })

    it('sanitizes stored HTML (members include non-admin partners)', () => {
      const db = fresh_db()
      seed_user(db, 'u-a', 'a@example.com')
      const room = seed_channel(db, 'General', ['u-a'])
      const message = post_message({ db, room_id: room.id, user_id: 'u-a', body_html: '<p onclick="steal()">hi</p><script>alert(1)</script>', body_text: 'hi' })
      expect(message.body_html).not.toContain('<script>')
      expect(message.body_html).not.toContain('onclick')
      expect(message.body_html).toContain('<p>hi</p>')
      const edited = edit_message({ db, message_id: message.id, user_id: 'u-a', body_html: '<img src=x onerror=alert(1)>', body_text: 'x' })
      expect(edited.body_html).not.toContain('onerror')
    })
  })

  describe(list_my_rooms, () => {
    it('counts unread from others but not my own messages, and clears on read', () => {
      const db = fresh_db()
      seed_user(db, 'u-a', 'a@example.com')
      seed_user(db, 'u-b', 'b@example.com')
      const room = seed_channel(db, 'General', ['u-a', 'u-b'])
      post_message({ db, room_id: room.id, user_id: 'u-a', body_html: '<p>1</p>', body_text: '1' })
      post_message({ db, room_id: room.id, user_id: 'u-a', body_html: '<p>2</p>', body_text: '2' })
      const b_room = list_my_rooms({ db, user_id: 'u-b' }).find(summary => summary.id === room.id)
      expect(b_room?.unread).toBe(2)
      const a_room = list_my_rooms({ db, user_id: 'u-a' }).find(summary => summary.id === room.id)
      expect(a_room?.unread).toBe(0)
      mark_read({ db, room_id: room.id, user_id: 'u-b' })
      const after_read = list_my_rooms({ db, user_id: 'u-b' }).find(summary => summary.id === room.id)
      expect(after_read?.unread).toBe(0)
    })

    it('computes can_manage per caller level (admin room vs regular)', () => {
      const db = fresh_db()
      seed_user(db, 'u-a', 'a@example.com')
      const regular = seed_channel(db, 'Regular', ['u-a'])
      const admin_room = create_channel({ db, name: 'Admin room', created_by_user_id: 'u-a', admin_room: true })
      const as_admin = list_my_rooms({ db, user_id: 'u-a', admin_level: 2 })
      expect(as_admin.find(summary => summary.id === regular.id)?.can_manage).toBe(true)
      expect(as_admin.find(summary => summary.id === admin_room.id)?.can_manage).toBe(false)
      const as_super = list_my_rooms({ db, user_id: 'u-a', admin_level: 3 })
      expect(as_super.find(summary => summary.id === admin_room.id)?.can_manage).toBe(true)
      const as_member = list_my_rooms({ db, user_id: 'u-a' })
      expect(as_member.find(summary => summary.id === regular.id)?.can_manage).toBe(false)
    })
  })

  describe(ensure_dm, () => {
    it('produces a stable id regardless of argument order', () => {
      const db = fresh_db()
      const id_a = ensure_dm({ db, user_id: 'u-a', other_user_id: 'u-b' })
      const id_b = ensure_dm({ db, user_id: 'u-b', other_user_id: 'u-a' })
      expect(id_a).toBe(id_b)
      expect(list_my_rooms({ db, user_id: 'u-a' }).some(room => room.id === id_a)).toBe(true)
      expect(list_my_rooms({ db, user_id: 'u-b' }).some(room => room.id === id_a)).toBe(true)
    })
  })

  describe(add_chat_attachment, () => {
    it('links an attachment to an own message and hydrates it on read', () => {
      const db = fresh_db()
      seed_user(db, 'u-a', 'a@example.com')
      const room = seed_channel(db, 'General', ['u-a'])
      const message = post_message({ db, room_id: room.id, user_id: 'u-a', body_html: '', body_text: '', allow_empty: true })
      add_chat_attachment({ db, message_id: message.id, user_id: 'u-a', storage_key: 'key-1', filename: 'shot.png', mimetype: 'image/png', size_bytes: 1234 })
      const [loaded] = get_room_messages({ db, room_id: room.id, user_id: 'u-a' })
      expect(loaded.attachments).toHaveLength(1)
      expect(loaded.attachments[0].filename).toBe('shot.png')
    })

    it('refuses to attach to someone else\'s message', () => {
      const db = fresh_db()
      seed_user(db, 'u-a', 'a@example.com')
      seed_user(db, 'u-b', 'b@example.com')
      const room = seed_channel(db, 'General', ['u-a', 'u-b'])
      const message = post_message({ db, room_id: room.id, user_id: 'u-a', body_html: '<p>x</p>', body_text: 'x' })
      expect(() => add_chat_attachment({ db, message_id: message.id, user_id: 'u-b', storage_key: 'k', filename: 'f', mimetype: null, size_bytes: null })).toThrow(ChatError)
    })
  })

  describe(get_chat_attachment_for_serve, () => {
    it('returns serve metadata to a room member and blocks non-members', () => {
      const db = fresh_db()
      seed_user(db, 'u-a', 'a@example.com')
      seed_user(db, 'u-b', 'b@example.com')
      const room = seed_channel(db, 'Private', ['u-a'])
      const message = post_message({ db, room_id: room.id, user_id: 'u-a', body_html: '<p>x</p>', body_text: 'x' })
      const attachment = add_chat_attachment({ db, message_id: message.id, user_id: 'u-a', storage_key: 'key-9', filename: 'doc.pdf', mimetype: 'application/pdf', size_bytes: 9 })
      const serve = get_chat_attachment_for_serve({ db, attachment_id: attachment.id, user_id: 'u-a' })
      expect(serve.storage_key).toBe('key-9')
      expect(() => get_chat_attachment_for_serve({ db, attachment_id: attachment.id, user_id: 'u-b' })).toThrow(ChatError)
    })
  })

  describe(delete_message, () => {
    it('scrubs content and drops it from unread counts', () => {
      const db = fresh_db()
      seed_user(db, 'u-a', 'a@example.com')
      seed_user(db, 'u-b', 'b@example.com')
      const room = seed_channel(db, 'General', ['u-a', 'u-b'])
      const message = post_message({ db, room_id: room.id, user_id: 'u-a', body_html: '<p>secret</p>', body_text: 'secret' })
      delete_message({ db, message_id: message.id, user_id: 'u-a' })
      const b_room = list_my_rooms({ db, user_id: 'u-b' }).find(summary => summary.id === room.id)
      expect(b_room?.unread).toBe(0)
      expect(b_room?.last_message).toBeNull()
    })

    it('refuses to delete someone else\'s message', () => {
      const db = fresh_db()
      seed_user(db, 'u-a', 'a@example.com')
      seed_user(db, 'u-b', 'b@example.com')
      const room = seed_channel(db, 'General', ['u-a', 'u-b'])
      const message = post_message({ db, room_id: room.id, user_id: 'u-a', body_html: '<p>mine</p>', body_text: 'mine' })
      expect(() => delete_message({ db, message_id: message.id, user_id: 'u-b' })).toThrow(ChatError)
    })
  })

  describe(toggle_reaction, () => {
    it('adds, aggregates, and removes reactions; hydrates onto the message', () => {
      const db = fresh_db()
      seed_user(db, 'u-a', 'a@example.com')
      seed_user(db, 'u-b', 'b@example.com')
      const room = seed_channel(db, 'General', ['u-a', 'u-b'])
      const message = post_message({ db, room_id: room.id, user_id: 'u-a', body_html: '<p>hi</p>', body_text: 'hi' })

      toggle_reaction({ db, message_id: message.id, user_id: 'u-a', emoji: '👍' })
      const after_two = toggle_reaction({ db, message_id: message.id, user_id: 'u-b', emoji: '👍' })
      expect(after_two).toEqual([{ emoji: '👍', user_ids: ['u-a', 'u-b'] }])

      const [hydrated] = get_room_messages({ db, room_id: room.id, user_id: 'u-a' })
      expect(hydrated.reactions).toEqual([{ emoji: '👍', user_ids: ['u-a', 'u-b'] }])

      const after_toggle_off = toggle_reaction({ db, message_id: message.id, user_id: 'u-a', emoji: '👍' })
      expect(after_toggle_off).toEqual([{ emoji: '👍', user_ids: ['u-b'] }])
    })

    it('rejects non-members and deleted messages', () => {
      const db = fresh_db()
      seed_user(db, 'u-a', 'a@example.com')
      seed_user(db, 'u-b', 'b@example.com')
      const room = seed_channel(db, 'General', ['u-a'])
      const message = post_message({ db, room_id: room.id, user_id: 'u-a', body_html: '<p>hi</p>', body_text: 'hi' })
      expect(() => toggle_reaction({ db, message_id: message.id, user_id: 'u-b', emoji: '👍' })).toThrow(ChatError)
      delete_message({ db, message_id: message.id, user_id: 'u-a' })
      expect(() => toggle_reaction({ db, message_id: message.id, user_id: 'u-a', emoji: '👍' })).toThrow(ChatError)
    })
  })

  describe(get_room_read_positions, () => {
    it('returns every member\'s last_read_at and gates on membership', () => {
      const db = fresh_db()
      seed_user(db, 'u-a', 'a@example.com')
      seed_user(db, 'u-b', 'b@example.com')
      seed_user(db, 'u-c', 'c@example.com')
      const room = seed_channel(db, 'General', ['u-a', 'u-b'])
      // u-a posting marks u-a read; u-b hasn't read yet.
      post_message({ db, room_id: room.id, user_id: 'u-a', body_html: '<p>hi</p>', body_text: 'hi' })
      const positions = get_room_read_positions({ db, room_id: room.id, user_id: 'u-a' })
      const by_user = Object.fromEntries(positions.map(row => [row.user_id, row.last_read_at]))
      expect(by_user['u-a']).not.toBeNull()
      expect(by_user['u-b']).toBeNull()
      expect(() => get_room_read_positions({ db, room_id: room.id, user_id: 'u-c' })).toThrow(ChatError)
    })
  })
}
