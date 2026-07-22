import type Database from 'better-sqlite3'

/**
 * Record that an authenticated user was active, at most once per UTC day.
 *
 * Called from the root `+layout.server.ts` whenever the `session` cookie
 * verifies, so `users.last_visit_at` reflects EVERY logged-in visit — not just
 * the admins who run the shared.db sync engine (which was the only writer
 * before, hence "active last 30 days" only ever listed admins).
 *
 * The write is a single guarded UPDATE: it no-ops unless `last_visit_at` is
 * NULL or from a previous UTC day, so the hot SSR path pays ~one write per user
 * per day. The `users_after_last_visit_at_bump_updated_at` trigger then bumps
 * `updated_at`, ferrying the new value to every admin's local DB on next sync.
 */
export function bump_last_visit({ db, user_id, now = new Date() }: {
  db: Database.Database
  user_id: string
  now?: Date
}): void {
  try {
    const today = now.toISOString().slice(0, 10) // YYYY-MM-DD (UTC)
    db.prepare(
      `UPDATE users
       SET last_visit_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?
         AND (last_visit_at IS NULL OR substr(last_visit_at, 1, 10) < ?)`,
    ).run(user_id, today)
  } catch (err) {
    // Activity tracking must never break page rendering.
    console.error('[bump_last_visit] failed:', (err as Error).message)
  }
}

if (import.meta.vitest) {
  const { default: BetterSqlite3 } = await import('better-sqlite3')

  function make_db(): Database.Database {
    const db = new BetterSqlite3(':memory:')
    db.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        last_visit_at TEXT,
        updated_at TEXT
      );
    `)
    return db
  }

  describe(bump_last_visit, () => {
    test('sets last_visit_at when previously NULL', () => {
      const db = make_db()
      db.prepare('INSERT INTO users (id, last_visit_at) VALUES (?, NULL)').run('u1')
      bump_last_visit({ db, user_id: 'u1' })
      const row = db.prepare('SELECT last_visit_at FROM users WHERE id = ?').get('u1') as { last_visit_at: string | null }
      expect(row.last_visit_at).not.toBeNull()
    })

    test('bumps when the stored visit is from a previous day', () => {
      const db = make_db()
      db.prepare('INSERT INTO users (id, last_visit_at) VALUES (?, ?)').run('u1', '2020-01-01T09:00:00.000Z')
      bump_last_visit({ db, user_id: 'u1', now: new Date('2026-07-12T08:00:00.000Z') })
      const row = db.prepare('SELECT last_visit_at FROM users WHERE id = ?').get('u1') as { last_visit_at: string }
      expect(row.last_visit_at.slice(0, 10)).not.toBe('2020-01-01')
    })

    test('no-ops when already recorded today', () => {
      const db = make_db()
      const today_iso = new Date('2026-07-12T01:00:00.000Z').toISOString()
      db.prepare('INSERT INTO users (id, last_visit_at) VALUES (?, ?)').run('u1', today_iso)
      bump_last_visit({ db, user_id: 'u1', now: new Date('2026-07-12T23:00:00.000Z') })
      const row = db.prepare('SELECT last_visit_at FROM users WHERE id = ?').get('u1') as { last_visit_at: string }
      expect(row.last_visit_at).toBe(today_iso)
    })

    test('does not throw for an unknown user', () => {
      const db = make_db()
      expect(() => bump_last_visit({ db, user_id: 'ghost' })).not.toThrow()
    })
  })
}
