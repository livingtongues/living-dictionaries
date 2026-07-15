/**
 * Post a platform event (new dictionary / new user / invite) into the admin
 * "Notifications" room as the System bot. It records the audit/message row (which
 * drives the in-app unread badge) but sends NO immediate external ping — those
 * events are batched into ONE daily 8am-Pacific digest by
 * `notification-digest-cron.ts` (Jacob's call: the per-event ping was noisy and
 * never summarized). Regular DMs/channels still ping instantly.
 *
 * Fire-and-forget from request handlers (`void post_system_notification(...)`):
 * the message INSERT runs synchronously, so the row is persisted regardless.
 */
import type Database from 'better-sqlite3'
import type { SystemNotificationContent } from './notification-messages'
import { post_message } from './chat-db'
import { ROOM_NOTIFICATIONS, SYSTEM_USER_NAME } from './constants'
import { SYSTEM_USER_ID } from '$lib/chat/constants'

const NOTIFICATIONS_ROOM_NAME = 'Notifications'

/**
 * Idempotently ensure the System bot user + Notifications room exist. The System
 * bot is deliberately NOT a room member — it posts by bypassing the membership
 * gate (see `post_message`), and a bot must never show up in a member list.
 */
function ensure_system_notifier(db: Database.Database): void {
  const now = new Date().toISOString()
  db.prepare('INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, NULL, ?, \'[]\', ?, ?) ON CONFLICT(id) DO NOTHING')
    .run(SYSTEM_USER_ID, SYSTEM_USER_NAME, now, now)
  db.prepare('INSERT INTO chat_rooms (id, kind, name, admin_room, created_at, updated_at) VALUES (?, \'channel\', ?, 1, ?, ?) ON CONFLICT(id) DO NOTHING')
    .run(ROOM_NOTIFICATIONS, NOTIFICATIONS_ROOM_NAME, now, now)
}

export function post_system_notification({ db, content }: {
  db: Database.Database
  content: SystemNotificationContent
}): void {
  ensure_system_notifier(db)

  post_message({
    db,
    room_id: ROOM_NOTIFICATIONS,
    user_id: SYSTEM_USER_ID,
    body_html: content.body_html,
    body_text: content.body_text,
  })
}

if (import.meta.vitest) {
  const { open_test_shared_db } = await import('$lib/db/server/shared-db')
  const { seed_admins_in_notifications } = await import('./chat-test-helpers')
  const { format_new_dictionary_notification } = await import('./notification-messages')

  function notified_at(db: Database.Database, room_id: string, user_id: string): string | null {
    return (db.prepare('SELECT last_notified_at FROM chat_room_members WHERE room_id = ? AND user_id = ?').get(room_id, user_id) as { last_notified_at: string | null } | undefined)?.last_notified_at ?? null
  }

  function diego_id(db: Database.Database): string {
    return (db.prepare('SELECT id FROM users WHERE email = ?').get('diego@livingtongues.org') as { id: string }).id
  }

  const content = format_new_dictionary_notification({ dictionary_name: 'Test', dictionary_id: 'test', actor: 'someone@example.com', base_url: 'https://new.livingdictionaries.app' })

  describe(post_system_notification, () => {
    it('posts the message to the Notifications room as the System bot', () => {
      const db = open_test_shared_db()
      seed_admins_in_notifications(db)
      post_system_notification({ db, content })
      const row = db.prepare('SELECT author_user_id, body_text FROM chat_messages WHERE room_id = ?').get(ROOM_NOTIFICATIONS) as { author_user_id: string, body_text: string } | undefined
      expect(row?.author_user_id).toBe(SYSTEM_USER_ID)
      expect(row?.body_text).toContain('created a new dictionary')
    })

    it('does NOT make the System bot a room member', () => {
      const db = open_test_shared_db()
      seed_admins_in_notifications(db)
      post_system_notification({ db, content })
      expect(db.prepare('SELECT 1 FROM chat_room_members WHERE room_id = ? AND user_id = ?').get(ROOM_NOTIFICATIONS, SYSTEM_USER_ID)).toBeUndefined()
    })

    it('sends NO immediate external ping (batched into the daily digest instead)', () => {
      const db = open_test_shared_db()
      seed_admins_in_notifications(db)
      post_system_notification({ db, content })
      expect(notified_at(db, ROOM_NOTIFICATIONS, diego_id(db))).toBeNull()
    })
  })
}
