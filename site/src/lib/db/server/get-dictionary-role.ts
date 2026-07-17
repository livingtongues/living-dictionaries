import type { Database } from 'better-sqlite3'
import { get_shared_db, open_test_shared_db } from './shared-db'

export type DictRole = 'manager' | 'contributor'

/**
 * The signed-in user's `dictionary_roles` grant for one dictionary, resolved
 * server-side from `shared.db`. Used to SSR-hydrate the role so manager-gated
 * dictionary pages (history, etc.) don't 403 on a hard load — the browser
 * `dict_roles` localStorage cache is empty during SSR (`!browser`), so without
 * this the SSR role is always null for non-admin contributors/managers.
 *
 * Ordered most-recent-first to mirror the `/api/me/dictionary-roles` feed the
 * client cache is built from. Returns null when there is no grant.
 */
export function get_user_dict_role({ dictionary_id, user_id, db = get_shared_db() }: { dictionary_id: string, user_id: string, db?: Database }): DictRole | null {
  const row = db.prepare(
    `SELECT role FROM dictionary_roles
     WHERE dictionary_id = ? AND user_id = ?
     ORDER BY created_at DESC
     LIMIT 1`,
  ).get(dictionary_id, user_id) as { role: DictRole } | undefined
  return row?.role ?? null
}

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest

  function seed() {
    const db = open_test_shared_db()
    const add_dict = db.prepare(`INSERT INTO dictionaries (id, name) VALUES (?, ?)`)
    const add_user = db.prepare(`INSERT INTO users (id, email) VALUES (?, ?)`)
    const add_role = db.prepare(`INSERT INTO dictionary_roles (id, dictionary_id, user_id, role, created_at) VALUES (?, ?, ?, ?, ?)`)
    for (const id of ['demo', 'other', 'dupe']) add_dict.run(id, id)
    for (const id of ['u1', 'u2', 'u3']) add_user.run(id, `${id}@example.com`)
    add_role.run('r1', 'demo', 'u1', 'manager', '2026-01-01T00:00:00.000Z')
    add_role.run('r2', 'demo', 'u2', 'contributor', '2026-01-01T00:00:00.000Z')
    add_role.run('r3', 'other', 'u1', 'contributor', '2026-01-01T00:00:00.000Z')
    add_role.run('r4', 'dupe', 'u3', 'contributor', '2026-01-01T00:00:00.000Z')
    add_role.run('r5', 'dupe', 'u3', 'manager', '2026-02-01T00:00:00.000Z')
    return db
  }

  describe(get_user_dict_role, () => {
    const db = seed()

    it('returns the grant for a user on a dictionary', () => {
      expect(get_user_dict_role({ dictionary_id: 'demo', user_id: 'u1', db })).toBe('manager')
      expect(get_user_dict_role({ dictionary_id: 'demo', user_id: 'u2', db })).toBe('contributor')
    })

    it('returns null when the user has no grant on that dictionary', () => {
      expect(get_user_dict_role({ dictionary_id: 'demo', user_id: 'nobody', db })).toBe(null)
      expect(get_user_dict_role({ dictionary_id: 'missing', user_id: 'u1', db })).toBe(null)
    })

    it('returns the most-recent grant when multiple exist', () => {
      expect(get_user_dict_role({ dictionary_id: 'dupe', user_id: 'u3', db })).toBe('manager')
    })
  })
}
