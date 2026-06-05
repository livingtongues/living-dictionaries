/**
 * Once-per-day "I'm here" ping driven by the sync engine.
 *
 * The engine asks `should_ping_last_visit({ user_id })` at the top of each
 * sync run. If today's local date differs from the date we last recorded for
 * this user in `localStorage`, the engine sets `update_last_visit: true` on
 * the sync request — the server then writes `users.last_visit_at` for that
 * user, and a SQL trigger bumps the row's `updated_at` so the sync ferries
 * the new value back to every admin's local DB.
 */

function storage_key(user_id: string): string {
  return `last_visit_ping_date:${user_id}`
}

/** YYYY-MM-DD in the local timezone. */
export function today_local_date(now: Date = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function should_ping_last_visit({ user_id, storage = safe_local_storage(), now = new Date() }: {
  user_id: string
  storage?: Pick<Storage, 'getItem'> | null
  now?: Date
}): boolean {
  if (!storage)
    return false
  const last_recorded = storage.getItem(storage_key(user_id))
  return last_recorded !== today_local_date(now)
}

export function record_last_visit_ping({ user_id, storage = safe_local_storage(), now = new Date() }: {
  user_id: string
  storage?: Pick<Storage, 'setItem'> | null
  now?: Date
}): void {
  if (!storage)
    return
  storage.setItem(storage_key(user_id), today_local_date(now))
}

function safe_local_storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

if (import.meta.vitest) {
  function make_storage(initial: Record<string, string> = {}): Pick<Storage, 'getItem' | 'setItem'> {
    const store = new Map(Object.entries(initial))
    return {
      getItem: key => store.get(key) ?? null,
      setItem: (key, value) => {
        store.set(key, value)
      },
    }
  }

  describe(today_local_date, () => {
    it('formats as YYYY-MM-DD', () => {
      const date = new Date(2026, 4, 21, 14, 30)
      expect(today_local_date(date)).toBe('2026-05-21')
    })

    it('zero-pads single-digit month and day', () => {
      const date = new Date(2026, 0, 5, 0, 0)
      expect(today_local_date(date)).toBe('2026-01-05')
    })
  })

  describe(should_ping_last_visit, () => {
    it('returns true on first ever check (no stored date)', () => {
      const storage = make_storage()
      const now = new Date(2026, 4, 21, 9, 0)
      expect(should_ping_last_visit({ user_id: 'u1', storage, now })).toBe(true)
    })

    it('returns false when today\'s date is already recorded', () => {
      const storage = make_storage({ 'last_visit_ping_date:u1': '2026-05-21' })
      const now = new Date(2026, 4, 21, 23, 59)
      expect(should_ping_last_visit({ user_id: 'u1', storage, now })).toBe(false)
    })

    it('keys per user', () => {
      const storage = make_storage({ 'last_visit_ping_date:u1': '2026-05-21' })
      const now = new Date(2026, 4, 21, 12, 0)
      expect(should_ping_last_visit({ user_id: 'u1', storage, now })).toBe(false)
      expect(should_ping_last_visit({ user_id: 'u2', storage, now })).toBe(true)
    })
  })

  describe(record_last_visit_ping, () => {
    it('flips should_ping_last_visit to false for the same day', () => {
      const storage = make_storage()
      const now = new Date(2026, 4, 21, 9, 0)
      expect(should_ping_last_visit({ user_id: 'u1', storage, now })).toBe(true)
      record_last_visit_ping({ user_id: 'u1', storage, now })
      expect(should_ping_last_visit({ user_id: 'u1', storage, now })).toBe(false)
    })
  })
}
