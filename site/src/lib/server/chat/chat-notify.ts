/**
 * Decide who to externally ping for a new chat message, applying the anti-spam
 * policy, then send via each member's chosen channel (`notify_admin` honors
 * ntfy-vs-email). Policy per member U (≠ author):
 *   1. skip if U is online in the admin (presence window) → in-app badge covers it
 *   2. skip if already pinged since U last read this room (one ping per unread batch)
 *   3. else ping and stamp `last_notified_at`
 * The 1-day gentle re-ping lives in chat-reping-cron. Fire-and-forget from the
 * send endpoint — never block the HTTP response on it.
 */
import type Database from 'better-sqlite3'
import type { ChatMessageRow } from './chat-db'
import { ADMINS } from '$lib/admins'
import { open_shared_db } from '$lib/db/server/shared-db'
import { notify_admin } from '$lib/notifications/notify-admins'
import { ensure_my_chat_setup, get_room, online_user_ids, post_message, touch_presence } from './chat-db'
import { ROOM_ALL_ADMINS, ROOM_NAMES } from './constants'
import { build_chat_notification_email } from './notification-email'

interface MemberRow {
  user_id: string
  email: string | null
  last_read_at: string | null
  last_notified_at: string | null
}

/** Emails of admins who keep access but opt out of broadcast-style pings. */
const off_duty_emails = new Set(ADMINS.filter(admin => admin.notify === false).map(admin => admin.email))

/**
 * Per-member external-ping policy for a room, shared by team-chat messages and
 * System notifications. For each member ≠ author:
 *   1. skip if online (presence window) → the in-app unread badge covers it
 *   2. skip if already pinged since they last read this room (one per unread batch)
 *   3. (notifications only) skip off-duty admins — broadcast-style notices honor `notify:false`
 *   4. else ping via their chosen channel + stamp `last_notified_at` (resetting
 *      gentle_reping_at so the 1-day gentle re-ping re-arms)
 */
export async function ping_room_members({ db, room_id, author_user_id, subject, body, link, email, respect_off_duty = false }: {
  db: Database.Database
  room_id: string
  author_user_id: string
  subject: string
  body: string
  link: string
  email: { subject: string, html: string, text: string }
  respect_off_duty?: boolean
}): Promise<void> {
  const members = db.prepare('SELECT m.user_id, m.last_read_at, m.last_notified_at, u.email FROM chat_room_members m LEFT JOIN users u ON u.id = m.user_id WHERE m.room_id = ? AND m.user_id != ?')
    .all(room_id, author_user_id) as MemberRow[]
  const online = online_user_ids({ db })
  const stamp = db.prepare('UPDATE chat_room_members SET last_notified_at = ?, gentle_reping_at = NULL WHERE room_id = ? AND user_id = ?')

  for (const member of members) {
    if (online.has(member.user_id))
      continue
    const already_pinged = !!member.last_notified_at && (!member.last_read_at || member.last_notified_at > member.last_read_at)
    if (already_pinged)
      continue
    if (!member.email)
      continue
    if (respect_off_duty && off_duty_emails.has(member.email))
      continue
    await notify_admin({ email: member.email, subject, body, link, email_html: email.html, email_text: email.text, email_subject: email.subject })
    stamp.run(new Date().toISOString(), room_id, member.user_id)
  }
}

export async function notify_room_message({ db, message, base_url }: { db: Database.Database, message: ChatMessageRow, base_url: string }): Promise<void> {
  const room = get_room({ db, room_id: message.room_id })
  if (!room)
    return

  const author_email = (db.prepare('SELECT email FROM users WHERE id = ?').get(message.author_user_id) as { email: string | null } | undefined)?.email ?? null
  const author_name = ADMINS.find(admin => admin.email === author_email)?.name ?? 'An admin'

  const is_dm = room.kind === 'dm'
  const room_name = room.name ?? ROOM_NAMES[room.id] ?? 'Team chat'
  const link = `${base_url}/admin/team?room=${encodeURIComponent(message.room_id)}`
  // Short ntfy push content.
  const subject = is_dm ? `New message from ${author_name}` : `New message in ${room_name}`
  const preview = message.body_text.replace(/\s+/g, ' ').trim().slice(0, 160)
  const body = is_dm ? preview || `${author_name} sent a message` : `${author_name}: ${preview}`
  // Rich email content — shows who it's from (the chat shows the name; the body
  // doesn't), plus the full message. Same builder the preview uses.
  const email = build_chat_notification_email({ author_name, room_name, body_html: message.body_html, body_text: message.body_text, link, is_dm })

  await ping_room_members({ db, room_id: message.room_id, author_user_id: message.author_user_id, subject, body, link, email })
}

if (import.meta.vitest) {
  function seed_two() {
    const db = open_shared_db(':memory:')
    const now = new Date().toISOString()
    // Two admins with real allow-listed emails so author_name + member email resolve.
    db.prepare('INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run('u-jacob', 'jwrunner7@gmail.com', 'Jacob', '[]', now, now)
    db.prepare('INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run('u-diego', 'diego@livingtongues.org', 'Diego', '[]', now, now)
    ensure_my_chat_setup({ db, user_id: 'u-jacob', email: 'jwrunner7@gmail.com' })
    ensure_my_chat_setup({ db, user_id: 'u-diego', email: 'diego@livingtongues.org' })
    return db
  }

  function notified_at(db: ReturnType<typeof open_shared_db>, user_id: string): string | null {
    return (db.prepare('SELECT last_notified_at FROM chat_room_members WHERE room_id = ? AND user_id = ?').get(ROOM_ALL_ADMINS, user_id) as { last_notified_at: string | null }).last_notified_at
  }

  describe(notify_room_message, () => {
    const original = process.env.NTFY_DISABLED
    beforeEach(() => { process.env.NTFY_DISABLED = '1' }) // no real ntfy/SES during the policy test
    afterEach(() => { process.env.NTFY_DISABLED = original })

    it('pings an offline member and stamps last_notified_at', async () => {
      const db = seed_two()
      const message = post_message({ db, room_id: ROOM_ALL_ADMINS, user_id: 'u-jacob', body_html: '<p>hi</p>', body_text: 'hi' })
      await notify_room_message({ db, message, base_url: 'https://new.livingdictionaries.app' })
      expect(notified_at(db, 'u-diego')).not.toBeNull()
    })

    it('does NOT ping a member who is online', async () => {
      const db = seed_two()
      touch_presence({ db, user_id: 'u-diego' })
      const message = post_message({ db, room_id: ROOM_ALL_ADMINS, user_id: 'u-jacob', body_html: '<p>hi</p>', body_text: 'hi' })
      await notify_room_message({ db, message, base_url: 'https://new.livingdictionaries.app' })
      expect(notified_at(db, 'u-diego')).toBeNull()
    })

    it('only pings once per unread batch (no re-ping until read)', async () => {
      const db = seed_two()
      const first = post_message({ db, room_id: ROOM_ALL_ADMINS, user_id: 'u-jacob', body_html: '<p>1</p>', body_text: '1' })
      await notify_room_message({ db, message: first, base_url: 'https://new.livingdictionaries.app' })
      const after_first = notified_at(db, 'u-diego')
      const second = post_message({ db, room_id: ROOM_ALL_ADMINS, user_id: 'u-jacob', body_html: '<p>2</p>', body_text: '2' })
      await notify_room_message({ db, message: second, base_url: 'https://new.livingdictionaries.app' })
      expect(notified_at(db, 'u-diego')).toBe(after_first) // unchanged → not re-pinged
    })
  })
}
