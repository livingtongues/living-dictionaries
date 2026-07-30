import type Database from 'better-sqlite3'
import { get_room, post_message } from './chat-db'
import { notify_room_message } from './chat-notify'
import { SYSTEM_USER_ID, SYSTEM_USER_NAME } from './constants'

/**
 * Post a message into a room authored by the **System** bot (Jacob's agent), on
 * Jacob's behalf, and fire the normal member notifications.
 *
 * WAS AN OUTBOX (`chat_system_outbox` + a 20s drain cron), because the agent
 * INSERTed the row from a separate `docker exec node` process that cannot reach
 * SES/ntfy — those only exist inside the SvelteKit runtime. So a queue carried
 * the message across the process boundary and a poller noticed it. That cost
 * 4,320 wakeups/day, delivered up to 20s late, and gave the agent no real
 * success/failure — it had to poll `processed_at` to find out (Jacob,
 * 2026-07-29: "The agent should get a failure if it doesn't work. It should
 * wait till its call returns.").
 *
 * Now the agent POSTs `/api/internal/system-chat` on the loopback port, which
 * calls this INSIDE the runtime: delivery is synchronous and its HTTP status is
 * the answer. Throws on failure so the caller gets a real error.
 */
export async function deliver_system_message({ db, room_id, body_html, body_text, skip_user_id = null, base_url }: {
  db: Database.Database
  room_id: string
  body_html: string
  body_text: string
  skip_user_id?: string | null
  base_url: string
}): Promise<{ message_id: string }> {
  if (!get_room({ db, room_id }))
    throw new Error(`room not found: ${room_id}`)

  ensure_system_user(db)
  const message = post_message({
    db,
    room_id,
    user_id: SYSTEM_USER_ID,
    body_html,
    body_text,
  })
  await notify_room_message({
    db,
    message,
    base_url,
    skip_user_ids: skip_user_id ? [skip_user_id] : [],
  })
  return { message_id: message.id }
}

/** Idempotently ensure the System bot's users row exists (its messages reference it). */
function ensure_system_user(db: Database.Database): void {
  const now = new Date().toISOString()
  db.prepare('INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, NULL, ?, \'[]\', ?, ?) ON CONFLICT(id) DO NOTHING')
    .run(SYSTEM_USER_ID, SYSTEM_USER_NAME, now, now)
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

  describe(deliver_system_message, () => {
    const original = process.env.NTFY_DISABLED
    beforeEach(() => { process.env.NTFY_DISABLED = '1' }) // no real ntfy/SES
    afterEach(() => {
      if (original === undefined)
        delete process.env.NTFY_DISABLED
      else
        process.env.NTFY_DISABLED = original
    })

    test('posts as System into the room and returns the message id', async () => {
      const db = open_test_shared_db()
      const dm = seed(db)
      const { message_id } = await deliver_system_message({
        db,
        room_id: dm,
        body_html: '<p>hi from the agent</p>',
        body_text: 'hi from the agent',
        skip_user_id: 'u-jacob',
        base_url: 'https://example.test',
      })
      expect(message_id).toBeTruthy()
      const messages = get_room_messages({ db, room_id: dm, user_id: 'u-greg' })
      const posted = messages[messages.length - 1]
      expect(posted?.body_text).toBe('hi from the agent')
      expect(posted?.author_user_id).toBe(SYSTEM_USER_ID)
    })

    test('THROWS on an unknown room so the caller gets a real failure', async () => {
      const db = open_test_shared_db()
      seed(db)
      await expect(deliver_system_message({
        db,
        room_id: 'no-such-room',
        body_html: '<p>x</p>',
        body_text: 'x',
        base_url: 'https://example.test',
      })).rejects.toThrow('room not found')
    })
  })
}
