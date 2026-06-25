/**
 * Server-authoritative data layer for the admin team chat. All chat tables live
 * in `shared.db` and are reached ONLY through these helpers + the
 * `/api/admin/chat/*` endpoints (never a sync sector) so per-room privacy holds.
 *
 * Membership is built lazily: `ensure_my_chat_setup` runs on every chat API hit
 * and joins the caller to every FIXED_CHANNELS room they belong to, so rooms
 * fill in as admins log in. Raw better-sqlite3 statements — chat has no JSON
 * columns, so the auto-parse driver isn't needed.
 */
import type Database from 'better-sqlite3'
import { open_shared_db } from '$lib/db/server/shared-db'
import {
  FIXED_CHANNELS,
  MESSAGE_PAGE_LIMIT,
  PRESENCE_WINDOW_MS,
  ROOM_ALL_ADMINS,
  ROOM_ANNA_GREG_JACOB,
  ROOM_DIEGO_ANNA_GREG,
  ROOM_NAMES,
} from './constants'

export type ChatRoomKind = 'channel' | 'dm'

export interface ChatRoom {
  id: string
  kind: ChatRoomKind
  name: string | null
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

export interface ChatMessageWithAttachments extends ChatMessageRow {
  attachments: ChatAttachment[]
}

export interface RoomSummary {
  id: string
  kind: ChatRoomKind
  name: string | null
  updated_at: string
  unread: number
  last_message: ChatMessageRow | null
  member_ids: string[]
  online_member_ids: string[]
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

/** Deterministic DM room id — the two user ids sorted so order never matters. */
export function dm_room_id(user_a: string, user_b: string): string {
  return `dm:${[user_a, user_b].sort().join(':')}`
}

/** Upsert the fixed channel rooms + ensure the caller's memberships per FIXED_CHANNELS. */
export function ensure_my_chat_setup({ db, user_id, email }: { db: Database.Database, user_id: string, email: string | undefined }): void {
  const ts = now_iso()
  const upsert_room = db.prepare('INSERT INTO chat_rooms (id, kind, name, created_at, updated_at) VALUES (?, \'channel\', ?, ?, ?) ON CONFLICT(id) DO NOTHING')
  const add_member = db.prepare('INSERT INTO chat_room_members (room_id, user_id, created_at) VALUES (?, ?, ?) ON CONFLICT(room_id, user_id) DO NOTHING')
  for (const channel of FIXED_CHANNELS) {
    upsert_room.run(channel.id, ROOM_NAMES[channel.id], ts, ts)
    if (channel.members === 'all' || (email && channel.members.includes(email)))
      add_member.run(channel.id, user_id, ts)
  }
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
    .run(id, room_id, user_id, body_html, body_text, client_message_id ?? null, ts, ts)
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
  return messages.map(message => ({ ...message, attachments: by_message.get(message.id) ?? [] }))
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
    return attach_attachments({ db, messages: rows })
  }
  const rows = db.prepare('SELECT * FROM chat_messages WHERE room_id = ? ORDER BY created_at DESC, id DESC LIMIT ?')
    .all(room_id, limit) as ChatMessageRow[]
  return attach_attachments({ db, messages: rows.reverse() })
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

export function list_my_rooms({ db, user_id }: { db: Database.Database, user_id: string }): RoomSummary[] {
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
    .run(body_html, body_text, ts, ts, message_id)
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
    return open_shared_db(':memory:')
  }

  describe(ensure_my_chat_setup, () => {
    it('joins all-admins for every admin + only the named channels they belong to', () => {
      const db = fresh_db()
      ensure_my_chat_setup({ db, user_id: 'u-jacob', email: 'jwrunner7@gmail.com' })
      const ids = list_my_rooms({ db, user_id: 'u-jacob' }).map(room => room.id).sort()
      expect(ids).toEqual([ROOM_ALL_ADMINS, ROOM_ANNA_GREG_JACOB].sort())
    })

    it('puts Diego in all-admins + diego-anna-greg but NOT anna-greg-jacob', () => {
      const db = fresh_db()
      ensure_my_chat_setup({ db, user_id: 'u-diego', email: 'diego@livingtongues.org' })
      const ids = list_my_rooms({ db, user_id: 'u-diego' }).map(room => room.id).sort()
      expect(ids).toEqual([ROOM_ALL_ADMINS, ROOM_DIEGO_ANNA_GREG].sort())
    })
  })

  describe(post_message, () => {
    it('is idempotent on client_message_id', () => {
      const db = fresh_db()
      ensure_my_chat_setup({ db, user_id: 'u-jacob', email: 'jwrunner7@gmail.com' })
      const first = post_message({ db, room_id: ROOM_ALL_ADMINS, user_id: 'u-jacob', body_html: '<p>hi</p>', body_text: 'hi', client_message_id: 'c1' })
      const again = post_message({ db, room_id: ROOM_ALL_ADMINS, user_id: 'u-jacob', body_html: '<p>hi</p>', body_text: 'hi', client_message_id: 'c1' })
      expect(again.id).toBe(first.id)
      expect(get_room_messages({ db, room_id: ROOM_ALL_ADMINS, user_id: 'u-jacob' })).toHaveLength(1)
    })

    it('rejects a non-member', () => {
      const db = fresh_db()
      ensure_my_chat_setup({ db, user_id: 'u-diego', email: 'diego@livingtongues.org' })
      expect(() => post_message({ db, room_id: ROOM_ANNA_GREG_JACOB, user_id: 'u-diego', body_html: '<p>x</p>', body_text: 'x' })).toThrow(ChatError)
    })

    it('allows an attachment-only (empty body) message when allow_empty', () => {
      const db = fresh_db()
      ensure_my_chat_setup({ db, user_id: 'u-jacob', email: 'jwrunner7@gmail.com' })
      const message = post_message({ db, room_id: ROOM_ALL_ADMINS, user_id: 'u-jacob', body_html: '', body_text: '', allow_empty: true })
      expect(message.id).toBeTruthy()
      expect(() => post_message({ db, room_id: ROOM_ALL_ADMINS, user_id: 'u-jacob', body_html: '', body_text: '' })).toThrow(ChatError)
    })
  })

  describe(list_my_rooms, () => {
    it('counts unread from others but not my own messages, and clears on read', () => {
      const db = fresh_db()
      ensure_my_chat_setup({ db, user_id: 'u-jacob', email: 'jwrunner7@gmail.com' })
      ensure_my_chat_setup({ db, user_id: 'u-diego', email: 'diego@livingtongues.org' })
      post_message({ db, room_id: ROOM_ALL_ADMINS, user_id: 'u-jacob', body_html: '<p>1</p>', body_text: '1' })
      post_message({ db, room_id: ROOM_ALL_ADMINS, user_id: 'u-jacob', body_html: '<p>2</p>', body_text: '2' })
      const diego_room = list_my_rooms({ db, user_id: 'u-diego' }).find(room => room.id === ROOM_ALL_ADMINS)
      expect(diego_room?.unread).toBe(2)
      const jacob_room = list_my_rooms({ db, user_id: 'u-jacob' }).find(room => room.id === ROOM_ALL_ADMINS)
      expect(jacob_room?.unread).toBe(0)
      mark_read({ db, room_id: ROOM_ALL_ADMINS, user_id: 'u-diego' })
      const after_read = list_my_rooms({ db, user_id: 'u-diego' }).find(room => room.id === ROOM_ALL_ADMINS)
      expect(after_read?.unread).toBe(0)
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
      ensure_my_chat_setup({ db, user_id: 'u-jacob', email: 'jwrunner7@gmail.com' })
      const message = post_message({ db, room_id: ROOM_ALL_ADMINS, user_id: 'u-jacob', body_html: '', body_text: '', allow_empty: true })
      add_chat_attachment({ db, message_id: message.id, user_id: 'u-jacob', storage_key: 'key-1', filename: 'shot.png', mimetype: 'image/png', size_bytes: 1234 })
      const [loaded] = get_room_messages({ db, room_id: ROOM_ALL_ADMINS, user_id: 'u-jacob' })
      expect(loaded.attachments).toHaveLength(1)
      expect(loaded.attachments[0].filename).toBe('shot.png')
    })

    it('refuses to attach to someone else\'s message', () => {
      const db = fresh_db()
      ensure_my_chat_setup({ db, user_id: 'u-jacob', email: 'jwrunner7@gmail.com' })
      ensure_my_chat_setup({ db, user_id: 'u-diego', email: 'diego@livingtongues.org' })
      const message = post_message({ db, room_id: ROOM_ALL_ADMINS, user_id: 'u-jacob', body_html: '<p>x</p>', body_text: 'x' })
      expect(() => add_chat_attachment({ db, message_id: message.id, user_id: 'u-diego', storage_key: 'k', filename: 'f', mimetype: null, size_bytes: null })).toThrow(ChatError)
    })
  })

  describe(get_chat_attachment_for_serve, () => {
    it('returns serve metadata to a room member and blocks non-members', () => {
      const db = fresh_db()
      ensure_my_chat_setup({ db, user_id: 'u-jacob', email: 'jwrunner7@gmail.com' })
      ensure_my_chat_setup({ db, user_id: 'u-diego', email: 'diego@livingtongues.org' })
      const message = post_message({ db, room_id: ROOM_ANNA_GREG_JACOB, user_id: 'u-jacob', body_html: '<p>x</p>', body_text: 'x' })
      const attachment = add_chat_attachment({ db, message_id: message.id, user_id: 'u-jacob', storage_key: 'key-9', filename: 'doc.pdf', mimetype: 'application/pdf', size_bytes: 9 })
      const serve = get_chat_attachment_for_serve({ db, attachment_id: attachment.id, user_id: 'u-jacob' })
      expect(serve.storage_key).toBe('key-9')
      expect(() => get_chat_attachment_for_serve({ db, attachment_id: attachment.id, user_id: 'u-diego' })).toThrow(ChatError)
    })
  })

  describe(delete_message, () => {
    it('scrubs content and drops it from unread counts', () => {
      const db = fresh_db()
      ensure_my_chat_setup({ db, user_id: 'u-jacob', email: 'jwrunner7@gmail.com' })
      ensure_my_chat_setup({ db, user_id: 'u-diego', email: 'diego@livingtongues.org' })
      const message = post_message({ db, room_id: ROOM_ALL_ADMINS, user_id: 'u-jacob', body_html: '<p>secret</p>', body_text: 'secret' })
      delete_message({ db, message_id: message.id, user_id: 'u-jacob' })
      const diego_room = list_my_rooms({ db, user_id: 'u-diego' }).find(room => room.id === ROOM_ALL_ADMINS)
      expect(diego_room?.unread).toBe(0)
      expect(diego_room?.last_message).toBeNull()
    })

    it('refuses to delete someone else\'s message', () => {
      const db = fresh_db()
      ensure_my_chat_setup({ db, user_id: 'u-jacob', email: 'jwrunner7@gmail.com' })
      ensure_my_chat_setup({ db, user_id: 'u-diego', email: 'diego@livingtongues.org' })
      const message = post_message({ db, room_id: ROOM_ALL_ADMINS, user_id: 'u-jacob', body_html: '<p>mine</p>', body_text: 'mine' })
      expect(() => delete_message({ db, message_id: message.id, user_id: 'u-diego' })).toThrow(ChatError)
    })
  })
}
