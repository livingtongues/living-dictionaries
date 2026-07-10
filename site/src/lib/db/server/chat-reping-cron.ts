/**
 * Gentle one-time re-ping cron for the admin team chat. Hourly, it finds members
 * whose chat ping has gone unread for ~1 day and sends EXACTLY ONE more nudge
 * (via their chosen channel), stamping `gentle_reping_at` so it never repeats for
 * that unread batch. A fresh ping resets `gentle_reping_at` (see notify_room_message).
 *
 * Same shape as the other crons: IS_STANDBY-guarded (primary container only) +
 * globalThis singleton. notify_admin is itself a no-op when NTFY_DISABLED=1, so
 * dev stays quiet even though the sweep query runs.
 */
import type Database from 'better-sqlite3'
import { env } from '$env/dynamic/private'
import { get_admin } from '$lib/admins'
import { notify_user } from '$lib/notifications/notify-admins'
import { get_room, online_user_ids, post_message } from '$lib/server/chat/chat-db'
import { log_server_event } from '$lib/server/log-server-event'
import { get_shared_db, open_test_shared_db } from './shared-db'

const REPING_AFTER_MS = 24 * 60 * 60 * 1000 // ~1 day unread → one gentle nudge
const CHECK_INTERVAL_MS = 60 * 60 * 1000 // hourly sweep
/** Deep-link base for the cron (no request context). Tracks the deployed domain via ORIGIN. */
const SITE_URL = env.ORIGIN || 'https://new.livingdictionaries.app'

interface RepingCandidate {
  room_id: string
  user_id: string
  last_read_at: string | null
  email: string | null
  name: string | null
}

/** One sweep pass. Exported for tests + a future "force" button. Returns # re-pinged. */
export async function sweep_chat_repings({ db = get_shared_db(), base_url = SITE_URL, now = new Date() }: {
  db?: Database.Database
  base_url?: string
  now?: Date
} = {}): Promise<number> {
  const cutoff = new Date(now.getTime() - REPING_AFTER_MS).toISOString()
  const candidates = db.prepare(`
    SELECT m.room_id, m.user_id, m.last_read_at, u.email, u.name
    FROM chat_room_members m
    LEFT JOIN users u ON u.id = m.user_id
    WHERE m.last_notified_at IS NOT NULL
      AND m.gentle_reping_at IS NULL
      AND m.last_notified_at <= ?
      AND (m.last_read_at IS NULL OR m.last_notified_at > m.last_read_at)
  `).all(cutoff) as RepingCandidate[]

  const online = online_user_ids({ db })
  const stamp = db.prepare('UPDATE chat_room_members SET gentle_reping_at = ? WHERE room_id = ? AND user_id = ?')
  let sent = 0

  for (const candidate of candidates) {
    if (!candidate.email || online.has(candidate.user_id))
      continue
    // Off-duty admins keep chat access but get no gentle re-pings.
    if (get_admin(candidate.email)?.notify === false)
      continue
    const has_unread = db.prepare(`
      SELECT 1 FROM chat_messages
      WHERE room_id = ? AND deleted_at IS NULL AND author_user_id != ?
        AND (? IS NULL OR created_at > ?)
      LIMIT 1
    `).get(candidate.room_id, candidate.user_id, candidate.last_read_at, candidate.last_read_at)
    if (!has_unread)
      continue

    const room = get_room({ db, room_id: candidate.room_id })
    const room_name = room?.name ?? 'the chat'
    const subject = room?.kind === 'dm' ? 'Still unread: a direct message' : `Still unread in ${room_name}`
    const body = room?.kind === 'dm' ? 'You still have an unread direct message.' : `You still have unread messages in ${room_name}.`
    const link = `${base_url}/chat?room=${encodeURIComponent(candidate.room_id)}`
    await notify_user({ email: candidate.email, name: candidate.name, subject, body, link })
    stamp.run(now.toISOString(), candidate.room_id, candidate.user_id)
    sent++
  }
  return sent
}

const SINGLETON_KEY = Symbol.for('ld.chat-reping-cron.state')
interface CronState { interval: ReturnType<typeof setInterval>, in_flight: boolean }
interface GlobalWithCron { [SINGLETON_KEY]?: CronState }

export function start_chat_reping_cron_once(): void {
  // Standby containers never run singleton jobs — only the primary.
  if (env.IS_STANDBY === 'true') {
    console.info('[chat-reping] IS_STANDBY — cron disabled on standby container.')
    return
  }
  const slot = globalThis as unknown as GlobalWithCron
  if (slot[SINGLETON_KEY]) {
    console.info('[chat-reping] Already running — skip.')
    return
  }
  const state: CronState = {
    interval: setInterval(() => run_guarded(state), CHECK_INTERVAL_MS),
    in_flight: false,
  }
  slot[SINGLETON_KEY] = state
  console.info(`[chat-reping] Started — sweeping every ${CHECK_INTERVAL_MS / 60_000}m.`)
}

export function stop_chat_reping_cron(): void {
  const slot = globalThis as unknown as GlobalWithCron
  const state = slot[SINGLETON_KEY]
  if (!state)
    return
  clearInterval(state.interval)
  delete slot[SINGLETON_KEY]
}

function run_guarded(state: CronState): void {
  if (state.in_flight)
    return
  state.in_flight = true
  void sweep_chat_repings()
    .then((sent) => { if (sent > 0) console.info(`[chat-reping] sent ${sent} gentle re-ping(s).`) })
    .catch((err) => {
      console.error('[chat-reping] sweep failed:', err)
      log_server_event({ level: 'error', message: 'chat_reping_sweep_failed', error: err })
    })
    .finally(() => { state.in_flight = false })
}

if (import.meta.vitest) {
  const { create_channel, add_room_member } = await import('$lib/server/chat/chat-db')

  function seed() {
    const db = open_test_shared_db()
    const ts = new Date().toISOString()
    // One admin + one non-admin partner member (repings must reach both).
    db.prepare('INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run('u-jacob', 'jwrunner7@gmail.com', 'Jacob', '[]', ts, ts)
    db.prepare('INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run('u-partner', 'partner@example.com', 'Pat Partner', '[]', ts, ts)
    const room = create_channel({ db, name: 'Project room', created_by_user_id: 'u-jacob' })
    add_room_member({ db, room_id: room.id, user_id: 'u-partner' })
    return { db, room_id: room.id }
  }

  function set_notified(db: ReturnType<typeof open_test_shared_db>, room_id: string, user_id: string, iso: string) {
    db.prepare('UPDATE chat_room_members SET last_notified_at = ? WHERE room_id = ? AND user_id = ?').run(iso, room_id, user_id)
  }
  function reping_at(db: ReturnType<typeof open_test_shared_db>, room_id: string, user_id: string): string | null {
    return (db.prepare('SELECT gentle_reping_at FROM chat_room_members WHERE room_id = ? AND user_id = ?').get(room_id, user_id) as { gentle_reping_at: string | null }).gentle_reping_at
  }

  describe(sweep_chat_repings, () => {
    const original = process.env.NTFY_DISABLED
    beforeEach(() => { process.env.NTFY_DISABLED = '1' })
    afterEach(() => { process.env.NTFY_DISABLED = original })

    it('re-pings a non-admin member unread for >1 day, exactly once', async () => {
      const { db, room_id } = seed()
      post_message({ db, room_id, user_id: 'u-jacob', body_html: '<p>hi</p>', body_text: 'hi' })
      set_notified(db, room_id, 'u-partner', new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()) // pinged 2 days ago

      const first = await sweep_chat_repings({ db })
      expect(first).toBe(1)
      expect(reping_at(db, room_id, 'u-partner')).not.toBeNull()

      const second = await sweep_chat_repings({ db }) // gentle_reping_at now set → no repeat
      expect(second).toBe(0)
    })

    it('does NOT re-ping when the ping is recent (<1 day)', async () => {
      const { db, room_id } = seed()
      post_message({ db, room_id, user_id: 'u-jacob', body_html: '<p>hi</p>', body_text: 'hi' })
      set_notified(db, room_id, 'u-partner', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // 1h ago
      expect(await sweep_chat_repings({ db })).toBe(0)
    })
  })
}
