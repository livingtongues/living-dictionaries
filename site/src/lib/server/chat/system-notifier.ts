/**
 * Post a platform event (new dictionary / new user / invite) into the admin
 * "Notifications" room as the System bot, then ping each admin member by their
 * preferred channel (ntfy/email) using the shared team-chat policy.
 *
 * `suppress_ping` (set when the actor was an admin) still records the message as
 * a log/audit row in the room, but sends NO external pings. Off-duty admins
 * (`notify:false`) are skipped from notification pings even when on someone
 * else's action — these are broadcast-style notices.
 *
 * Fire-and-forget from request handlers (`void post_system_notification(...)`):
 * the message INSERT runs synchronously before the first `await`, so the row is
 * persisted even if the caller doesn't await the network pings.
 */
import type Database from 'better-sqlite3'
import type { SystemNotificationContent } from './notification-messages'
import { build_chat_notification_email } from './notification-email'
import { ping_room_members } from './chat-notify'
import { post_message } from './chat-db'
import { ROOM_NOTIFICATIONS, SYSTEM_USER_NAME } from './constants'
import { SYSTEM_USER_ID } from '$lib/chat/constants'

const NOTIFICATIONS_ROOM_NAME = 'Notifications'

/** Idempotently ensure the System bot user + Notifications room + its membership. */
function ensure_system_notifier(db: Database.Database): void {
  const now = new Date().toISOString()
  db.prepare('INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, NULL, ?, \'[]\', ?, ?) ON CONFLICT(id) DO NOTHING')
    .run(SYSTEM_USER_ID, SYSTEM_USER_NAME, now, now)
  db.prepare('INSERT INTO chat_rooms (id, kind, name, admin_room, created_at, updated_at) VALUES (?, \'channel\', ?, 1, ?, ?) ON CONFLICT(id) DO NOTHING')
    .run(ROOM_NOTIFICATIONS, NOTIFICATIONS_ROOM_NAME, now, now)
  db.prepare('INSERT INTO chat_room_members (room_id, user_id, created_at) VALUES (?, ?, ?) ON CONFLICT(room_id, user_id) DO NOTHING')
    .run(ROOM_NOTIFICATIONS, SYSTEM_USER_ID, now)
}

export async function post_system_notification({ db, content, base_url, suppress_ping = false }: {
  db: Database.Database
  content: SystemNotificationContent
  base_url: string
  suppress_ping?: boolean
}): Promise<void> {
  ensure_system_notifier(db)

  post_message({
    db,
    room_id: ROOM_NOTIFICATIONS,
    user_id: SYSTEM_USER_ID,
    body_html: content.body_html,
    body_text: content.body_text,
  })

  if (suppress_ping)
    return

  const link = `${base_url}/chat?room=${encodeURIComponent(ROOM_NOTIFICATIONS)}`
  const email = build_chat_notification_email({
    author_name: SYSTEM_USER_NAME,
    room_name: NOTIFICATIONS_ROOM_NAME,
    body_html: content.body_html,
    body_text: content.body_text,
    link,
    is_dm: false,
  })
  email.subject = content.subject

  await ping_room_members({
    db,
    room_id: ROOM_NOTIFICATIONS,
    author_user_id: SYSTEM_USER_ID,
    subject: content.subject,
    body: content.body_text.replace(/\s+/g, ' ').trim().slice(0, 200),
    link,
    email,
    respect_off_duty: true,
  })
}

if (import.meta.vitest) {
  const { open_test_shared_db } = await import('$lib/db/server/shared-db')
  const { ensure_all_admins_in_team_chat } = await import('./ensure-team-membership')
  const { format_new_dictionary_notification } = await import('./notification-messages')

  function notified_at(db: Database.Database, room_id: string, user_id: string): string | null {
    return (db.prepare('SELECT last_notified_at FROM chat_room_members WHERE room_id = ? AND user_id = ?').get(room_id, user_id) as { last_notified_at: string | null } | undefined)?.last_notified_at ?? null
  }

  function diego_id(db: Database.Database): string {
    return (db.prepare('SELECT id FROM users WHERE email = ?').get('diego@livingtongues.org') as { id: string }).id
  }

  const content = format_new_dictionary_notification({ dictionary_name: 'Test', dictionary_id: 'test', actor: 'someone@example.com', base_url: 'https://new.livingdictionaries.app' })

  describe(post_system_notification, () => {
    const original = process.env.NTFY_DISABLED
    beforeEach(() => { process.env.NTFY_DISABLED = '1' })
    afterEach(() => { process.env.NTFY_DISABLED = original })

    it('posts the message to the Notifications room as the System bot', async () => {
      const db = open_test_shared_db()
      ensure_all_admins_in_team_chat({ db })
      await post_system_notification({ db, content, base_url: 'https://new.livingdictionaries.app' })
      const row = db.prepare('SELECT author_user_id, body_text FROM chat_messages WHERE room_id = ?').get(ROOM_NOTIFICATIONS) as { author_user_id: string, body_text: string } | undefined
      expect(row?.author_user_id).toBe(SYSTEM_USER_ID)
      expect(row?.body_text).toContain('created a new dictionary')
    })

    it('pings an on-duty admin member', async () => {
      const db = open_test_shared_db()
      ensure_all_admins_in_team_chat({ db })
      await post_system_notification({ db, content, base_url: 'https://new.livingdictionaries.app' })
      expect(notified_at(db, ROOM_NOTIFICATIONS, diego_id(db))).not.toBeNull()
    })

    it('suppress_ping posts the message but pings nobody', async () => {
      const db = open_test_shared_db()
      ensure_all_admins_in_team_chat({ db })
      await post_system_notification({ db, content, base_url: 'https://new.livingdictionaries.app', suppress_ping: true })
      expect(db.prepare('SELECT COUNT(*) AS c FROM chat_messages WHERE room_id = ?').get(ROOM_NOTIFICATIONS)).toEqual({ c: 1 })
      expect(notified_at(db, ROOM_NOTIFICATIONS, diego_id(db))).toBeNull()
    })

    it('skips off-duty admins (notify:false)', async () => {
      const db = open_test_shared_db()
      ensure_all_admins_in_team_chat({ db })
      await post_system_notification({ db, content, base_url: 'https://new.livingdictionaries.app' })
      const anna_id = (db.prepare('SELECT id FROM users WHERE email = ?').get('dictionaries@livingtongues.org') as { id: string }).id
      expect(notified_at(db, ROOM_NOTIFICATIONS, anna_id)).toBeNull()
    })
  })
}
