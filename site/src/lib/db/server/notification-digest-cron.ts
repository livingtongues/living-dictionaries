/**
 * Daily Notifications-room digest. The Notifications room no longer pings per
 * event (see system-notifier.ts) — instead, once a day at 8am Pacific this cron
 * sends each on-duty admin ONE summary of what's unread ("5 new users and 2 new
 * dictionaries → open notifications"). Nothing unread → no ping.
 *
 * Hourly sweep; fires the first time it runs at/after 8am `America/Los_Angeles`,
 * day-guarded in `db_metadata` so it sends at most once per Pacific day (survives
 * restarts + the 6h-style self-heal). Gated like the other crons: dormant in
 * dev/build, IS_STANDBY-gated (primary only), singleton.
 */
import type Database from 'better-sqlite3'
import { env } from '$env/dynamic/private'
import { get_admin } from '$lib/admins'
import { ROOM_NOTIFICATIONS } from '$lib/chat/constants'
import { notify_user } from '$lib/notifications/notify-admins'
import { summarize_notifications } from '$lib/server/chat/notification-messages'
import { log_server_event } from '$lib/server/log-server-event'
import { get_shared_db, open_test_shared_db } from './shared-db'

const DIGEST_HOUR_PT = 8
const DIGEST_DAY_KEY = 'notification_digest_last_day'
const SITE_URL = env.ORIGIN || 'https://new.livingdictionaries.app'

interface DigestMember {
  user_id: string
  last_read_at: string | null
  email: string | null
  name: string | null
}

/** Pacific-time calendar day (`YYYY-MM-DD`) + hour (0-23) for `now`. */
export function pacific_day_and_hour(now: Date): { day: string, hour: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? ''
  let hour = Number.parseInt(get('hour'), 10)
  if (hour === 24)
    hour = 0 // some ICU builds render midnight as 24
  return { day: `${get('year')}-${get('month')}-${get('day')}`, hour }
}

/**
 * One sweep pass. Sends at most once per Pacific day (>= 8am). Exported for tests
 * + a future "force" button. Returns the number of admins pinged.
 */
export async function sweep_notification_digest({ db = get_shared_db(), base_url = SITE_URL, now = new Date(), notify = notify_user }: {
  db?: Database.Database
  base_url?: string
  now?: Date
  /** Injectable so tests can drive a failing recipient. */
  notify?: typeof notify_user
} = {}): Promise<number> {
  const { day, hour } = pacific_day_and_hour(now)
  if (hour < DIGEST_HOUR_PT)
    return 0
  const last_day = (db.prepare('SELECT value FROM db_metadata WHERE key = ?').get(DIGEST_DAY_KEY) as { value: string } | undefined)?.value
  if (last_day === day)
    return 0

  // CLAIM THE DAY BEFORE SENDING ANYTHING (2026-07-31 overnight brief). The stamp
  // used to be written after the loop, so ONE failing recipient — an SES throttle,
  // a bad address — threw out of the whole sweep with the day unclaimed, and the
  // next hourly tick re-sent to EVERY admin who had already received it. From 8am
  // Pacific to midnight that is up to 16 identical digests. Claiming first makes a
  // failed sweep cost at most one missed digest for one person (recorded below and
  // recoverable by hand) instead of a mailstorm for everyone.
  db.prepare('INSERT INTO db_metadata (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(DIGEST_DAY_KEY, day)

  const members = db.prepare('SELECT m.user_id, m.last_read_at, u.email, u.name FROM chat_room_members m LEFT JOIN users u ON u.id = m.user_id WHERE m.room_id = ?')
    .all(ROOM_NOTIFICATIONS) as DigestMember[]
  const link = `${base_url}/chat?room=${encodeURIComponent(ROOM_NOTIFICATIONS)}`
  const unread_stmt = db.prepare(`
    SELECT body_text FROM chat_messages
    WHERE room_id = ? AND deleted_at IS NULL AND author_user_id != ?
      AND (? IS NULL OR created_at > ?)
    ORDER BY created_at ASC
  `)
  let sent = 0

  for (const member of members) {
    if (!member.email)
      continue
    // Belt-and-braces behind the derived membership: the digest quotes platform
    // notices that carry new signups' email addresses, so it never leaves the
    // admin allow-list even if a membership row somehow got in by hand.
    const admin = get_admin(member.email)
    if (!admin)
      continue
    // Off-duty admins keep chat access but opt out of broadcast-style pings.
    if (admin.notify === false)
      continue
    const unread = unread_stmt.all(ROOM_NOTIFICATIONS, member.user_id, member.last_read_at, member.last_read_at) as { body_text: string }[]
    if (!unread.length)
      continue
    const summary = summarize_notifications({ messages: unread })
    // Per-recipient isolation, for the same reason the day is claimed up front:
    // one undeliverable address must not cost the other admins their digest.
    try {
      await notify({ email: member.email, name: member.name, subject: summary.subject, body: summary.body_text, link })
      sent++
    } catch (err) {
      log_server_event({ level: 'error', message: 'notification_digest_send_failed', error: err, context: { day }, user_id: member.user_id })
    }
  }

  return sent
}

/** The roster's `run`: one sweep with its queryable failure event. */
export async function run_notification_digest_sweep(): Promise<void> {
  try {
    const sent = await sweep_notification_digest()
    if (sent > 0)
      console.info(`[notification-digest] sent ${sent} daily digest(s).`)
  } catch (err) {
    console.error('[notification-digest] sweep failed:', err)
    log_server_event({ level: 'error', message: 'notification_digest_sweep_failed', error: err })
  }
}

if (import.meta.vitest) {
  const { seed_admins_in_notifications } = await import('$lib/server/chat/chat-test-helpers')
  const { post_system_notification } = await import('$lib/server/chat/system-notifier')
  const { format_new_user_notification, format_new_dictionary_notification } = await import('$lib/server/chat/notification-messages')

  function seed_notifications(db: ReturnType<typeof open_test_shared_db>) {
    seed_admins_in_notifications(db)
    post_system_notification({ db, content: format_new_user_notification({ actor: 'A', email: 'a@b.com', base_url: 'https://ld.app' }) })
    post_system_notification({ db, content: format_new_user_notification({ actor: 'B', email: 'b@b.com', base_url: 'https://ld.app' }) })
    post_system_notification({ db, content: format_new_dictionary_notification({ dictionary_name: 'D', dictionary_id: 'd1', actor: 'A', base_url: 'https://ld.app' }) })
  }

  const eight_am_pt = new Date('2026-07-14T15:30:00.000Z') // 08:30 PDT
  const pre_dawn_pt = new Date('2026-07-14T12:00:00.000Z') // 05:00 PDT

  describe(pacific_day_and_hour, () => {
    it('converts UTC to the Pacific calendar day + hour', () => {
      expect(pacific_day_and_hour(eight_am_pt)).toEqual({ day: '2026-07-14', hour: 8 })
      expect(pacific_day_and_hour(pre_dawn_pt)).toEqual({ day: '2026-07-14', hour: 5 })
    })
  })

  describe(sweep_notification_digest, () => {
    const original = process.env.NTFY_DISABLED
    beforeEach(() => { process.env.NTFY_DISABLED = '1' })
    afterEach(() => { process.env.NTFY_DISABLED = original })

    it('does nothing before 8am Pacific', async () => {
      const db = open_test_shared_db()
      seed_notifications(db)
      expect(await sweep_notification_digest({ db, now: pre_dawn_pt })).toBe(0)
      expect(db.prepare('SELECT value FROM db_metadata WHERE key = ?').get(DIGEST_DAY_KEY)).toBeUndefined()
    })

    it('pings each on-duty admin once at/after 8am, then day-guards the rest of the day', async () => {
      const db = open_test_shared_db()
      seed_notifications(db)
      // 4 admins (Jacob, Diego, Greg, Cailie), all on duty; System has no email.
      const first = await sweep_notification_digest({ db, now: eight_am_pt })
      expect(first).toBe(4)
      expect((db.prepare('SELECT value FROM db_metadata WHERE key = ?').get(DIGEST_DAY_KEY) as { value: string }).value).toBe('2026-07-14')
      // Same day → guarded.
      expect(await sweep_notification_digest({ db, now: new Date('2026-07-14T20:00:00.000Z') })).toBe(0)
    })

    it('NEVER digests a non-admin, even holding a membership row — it quotes signup emails', async () => {
      const db = open_test_shared_db()
      seed_notifications(db)
      const now = new Date().toISOString()
      db.prepare('INSERT INTO users (id, email, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run('u-evie', 'evie@example.com', 'Evie', now, now)
      db.prepare('INSERT INTO chat_room_members (room_id, user_id, created_at) VALUES (?, ?, ?)')
        .run(ROOM_NOTIFICATIONS, 'u-evie', now)
      // Still 4 — the 4 admins. Evie is in the room but not in the allow-list.
      expect(await sweep_notification_digest({ db, now: eight_am_pt })).toBe(4)
    })

    it('claims the day BEFORE sending, so one failed send never re-mails everyone on the next tick', async () => {
      const db = open_test_shared_db()
      seed_notifications(db)
      const attempted: string[] = []
      const failing_notify = ({ email }: { email?: string | null }) => {
        attempted.push(email ?? '')
        if (attempted.length === 1)
          return Promise.reject(new Error('SES throttled'))
        return Promise.resolve()
      }
      // 4 admins attempted, the first one fails → 3 delivered, and crucially the
      // day is already claimed, so the next hourly tick sends NOTHING.
      expect(await sweep_notification_digest({ db, now: eight_am_pt, notify: failing_notify })).toBe(3)
      expect(attempted).toHaveLength(4)
      expect((db.prepare('SELECT value FROM db_metadata WHERE key = ?').get(DIGEST_DAY_KEY) as { value: string }).value).toBe('2026-07-14')
      expect(await sweep_notification_digest({ db, now: new Date('2026-07-14T16:30:00.000Z'), notify: failing_notify })).toBe(0)
      expect(attempted).toHaveLength(4)
    })

    it('skips a member who has already read all notifications', async () => {
      const db = open_test_shared_db()
      seed_notifications(db)
      const diego_id = (db.prepare('SELECT id FROM users WHERE email = ?').get('diego@livingtongues.org') as { id: string }).id
      db.prepare('UPDATE chat_room_members SET last_read_at = ? WHERE room_id = ? AND user_id = ?')
        .run(new Date().toISOString(), ROOM_NOTIFICATIONS, diego_id)
      // Diego (read) drops out → the other 3 on-duty admins still get the digest.
      expect(await sweep_notification_digest({ db, now: eight_am_pt })).toBe(3)
    })
  })
}
