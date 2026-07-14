/**
 * Drain the `chat_system_outbox` queue. Jacob's agent enqueues a row (a raw
 * INSERT — dev `.data/shared.db`, prod `docker exec node`; see the
 * `/system-chat` command) and `system-outbox-cron.ts` calls `process_system_outbox`
 * to actually deliver it inside the SvelteKit runtime (where SES/ntfy live):
 * post the message as the System bot (bypassing room membership) and fire the
 * normal member notification, skipping the on-behalf-of human so they don't ping
 * themselves.
 *
 * Each row is stamped `processed_at` exactly once — on success, or on failure
 * with an `error` (so a bad row can't loop forever).
 */
import type Database from 'better-sqlite3'
import { get_room, post_message } from './chat-db'
import { notify_room_message } from './chat-notify'
import { SYSTEM_USER_ID, SYSTEM_USER_NAME } from './constants'

interface OutboxRow {
  id: string
  room_id: string
  body_html: string
  body_text: string
  skip_user_id: string | null
}

const OUTBOX_BATCH_LIMIT = 20

/** Idempotently ensure the System bot users row exists (its messages reference it). */
function ensure_system_user(db: Database.Database): void {
  const now = new Date().toISOString()
  db.prepare('INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, NULL, ?, \'[]\', ?, ?) ON CONFLICT(id) DO NOTHING')
    .run(SYSTEM_USER_ID, SYSTEM_USER_NAME, now, now)
}

/** Enqueue a System-authored message into a room. Returns the new row id. */
export function enqueue_system_message({ db, room_id, body_html, body_text, skip_user_id = null }: {
  db: Database.Database
  room_id: string
  body_html: string
  body_text: string
  skip_user_id?: string | null
}): string {
  const id = crypto.randomUUID()
  db.prepare('INSERT INTO chat_system_outbox (id, room_id, body_html, body_text, skip_user_id, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, room_id, body_html, body_text, skip_user_id, new Date().toISOString())
  return id
}

/** Process pending outbox rows. Returns the number successfully delivered. */
export async function process_system_outbox({ db, base_url }: {
  db: Database.Database
  base_url: string
}): Promise<number> {
  const rows = db.prepare('SELECT id, room_id, body_html, body_text, skip_user_id FROM chat_system_outbox WHERE processed_at IS NULL ORDER BY created_at ASC LIMIT ?')
    .all(OUTBOX_BATCH_LIMIT) as OutboxRow[]
  if (!rows.length)
    return 0

  ensure_system_user(db)
  const stamp = db.prepare('UPDATE chat_system_outbox SET processed_at = ?, error = ? WHERE id = ?')
  let delivered = 0

  for (const row of rows) {
    try {
      if (!get_room({ db, room_id: row.room_id }))
        throw new Error(`room not found: ${row.room_id}`)
      const message = post_message({
        db,
        room_id: row.room_id,
        user_id: SYSTEM_USER_ID,
        body_html: row.body_html,
        body_text: row.body_text,
      })
      await notify_room_message({
        db,
        message,
        base_url,
        skip_user_ids: row.skip_user_id ? [row.skip_user_id] : [],
      })
      stamp.run(new Date().toISOString(), null, row.id)
      delivered++
    } catch (err) {
      stamp.run(new Date().toISOString(), (err as Error).message, row.id)
      console.error(`[system-outbox] delivery failed for ${row.id}:`, (err as Error).message)
    }
  }
  return delivered
}

if (import.meta.vitest) {
  const { open_test_shared_db } = await import('$lib/db/server/shared-db')
  const { ensure_dm, get_room_messages } = await import('./chat-db')

  function seed(db: ReturnType<typeof open_test_shared_db>) {
    const now = new Date().toISOString()
    db.prepare('INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run('u-jacob', 'jwrunner7@gmail.com', 'Jacob', '[]', now, now)
    db.prepare('INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run('u-greg', 'greg@example.com', 'Greg', '[]', now, now)
    return ensure_dm({ db, user_id: 'u-jacob', other_user_id: 'u-greg' })
  }

  describe(process_system_outbox, () => {
    const original = process.env.NTFY_DISABLED
    beforeEach(() => { process.env.NTFY_DISABLED = '1' }) // no real ntfy/SES
    afterEach(() => { process.env.NTFY_DISABLED = original })

    it('posts a queued message as System into a DM it is not a member of', async () => {
      const db = open_test_shared_db()
      const dm = seed(db)
      enqueue_system_message({ db, room_id: dm, body_html: '<p>hi from the agent</p>', body_text: 'hi from the agent', skip_user_id: 'u-jacob' })
      const delivered = await process_system_outbox({ db, base_url: 'https://ld.app' })
      expect(delivered).toBe(1)
      const [message] = get_room_messages({ db, room_id: dm, user_id: 'u-greg' })
      expect(message.author_user_id).toBe(SYSTEM_USER_ID)
      expect(message.body_text).toBe('hi from the agent')
    })

    it('marks a row processed exactly once and skips it on the next sweep', async () => {
      const db = open_test_shared_db()
      const dm = seed(db)
      enqueue_system_message({ db, room_id: dm, body_html: '<p>x</p>', body_text: 'x' })
      expect(await process_system_outbox({ db, base_url: 'https://ld.app' })).toBe(1)
      expect(await process_system_outbox({ db, base_url: 'https://ld.app' })).toBe(0)
    })

    it('stamps an error (not a loop) for a missing room', async () => {
      const db = open_test_shared_db()
      seed(db)
      const id = enqueue_system_message({ db, room_id: 'no-such-room', body_html: '<p>x</p>', body_text: 'x' })
      expect(await process_system_outbox({ db, base_url: 'https://ld.app' })).toBe(0)
      const row = db.prepare('SELECT processed_at, error FROM chat_system_outbox WHERE id = ?').get(id) as { processed_at: string | null, error: string | null }
      expect(row.processed_at).not.toBeNull()
      expect(row.error).toContain('room not found')
    })
  })
}
