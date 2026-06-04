import type { UserProviderIdentity } from '$lib/db/schemas/shared.types'
import type Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'

export type Provider = 'email' | 'google' | 'apple'

interface UserRow {
  id: string
  email: string | null
  name: string | null
  avatar_url: string | null
  providers: string
  preferred_locale: string | null
  unsubscribed_from_emails: string | null
  last_visit_at: string | null
  created_at: string
  updated_at: string
}

type ParsedUser = Omit<UserRow, 'providers'> & { providers: UserProviderIdentity[] }

function parse(row: UserRow): ParsedUser {
  return { ...row, providers: JSON.parse(row.providers) as UserProviderIdentity[] }
}

/**
 * When a provider gives us no display name (most commonly: email-OTP signup,
 * where we only have the email), derive a default from the email's local part.
 * The user can rename themselves later via the profile UI.
 */
export function default_name_from_email(email: string | null | undefined): string | null {
  if (!email)
    return null
  const local = email.split('@')[0]?.trim()
  return local || null
}

/**
 * Find an existing user by `(provider, provider_id)` stored inside the
 * `users.providers` JSON array. If none, and a `trusted_email` is provided,
 * attempt to link to an existing user with that email by appending a new
 * entry to their `providers` array (email-verified OAuth providers and email
 * OTP are the canonical linking signal). Otherwise create a new user with
 * `providers = [{ provider, provider_id }]`.
 *
 * All DB work runs inside `db.transaction(() => …)()`. Because better-sqlite3
 * is synchronous and we run a single shared-db process, concurrent first-logins
 * for the same `(provider, provider_id)` cannot race into duplicate rows.
 *
 * Returns the resolved user (with `providers` parsed to its array shape) and
 * a boolean indicating whether a new user row was created.
 */
export interface FindOrCreateAuthUserParams {
  db: Database.Database
  provider: Provider
  provider_id: string
  /** Verified email used for cross-provider linking. */
  trusted_email?: string | null
  /** Fields to use when inserting a brand-new user row. */
  new_user: {
    email?: string | null
    name?: string | null
    avatar_url?: string | null
  }
}

export function find_or_create_auth_user({ db, provider, provider_id, trusted_email, new_user }: FindOrCreateAuthUserParams): { user: ParsedUser, created: boolean } {
  const run = db.transaction(() => {
    // 1. Existing identity in providers → return its user (backfilling a missing name from email).
    const by_identity = db.prepare(`
      SELECT * FROM users
      WHERE EXISTS (
        SELECT 1 FROM json_each(providers)
        WHERE json_extract(value, '$.provider') = ?
          AND json_extract(value, '$.provider_id') = ?
      )
      LIMIT 1
    `).get(provider, provider_id) as UserRow | undefined

    if (by_identity)
      return { user: parse(backfill_name_if_missing(db, by_identity)), created: false }

    // 2. Link to existing user with the same verified email by appending a new
    //    identity to their providers array. Also backfill a missing name.
    if (trusted_email) {
      const by_email = db.prepare('SELECT * FROM users WHERE email = ?').get(trusted_email) as UserRow | undefined
      if (by_email) {
        db.prepare(
          'UPDATE users SET providers = json_insert(providers, \'$[#]\', json_object(\'provider\', ?, \'provider_id\', ?)), updated_at = strftime(\'%Y-%m-%dT%H:%M:%fZ\', \'now\') WHERE id = ?',
        ).run(provider, provider_id, by_email.id)
        const refreshed = db.prepare('SELECT * FROM users WHERE id = ?').get(by_email.id) as UserRow
        return { user: parse(backfill_name_if_missing(db, refreshed)), created: false }
      }
    }

    // 3. Brand-new user — insert with a single-entry providers array.
    const id = randomUUID()
    const providers: UserProviderIdentity[] = [{ provider, provider_id }]
    const resolved_name = new_user.name?.trim() || default_name_from_email(new_user.email)
    db.prepare(
      'INSERT INTO users (id, email, name, avatar_url, providers) VALUES (?, ?, ?, ?, ?)',
    ).run(
      id,
      new_user.email ?? null,
      resolved_name ?? null,
      new_user.avatar_url ?? null,
      JSON.stringify(providers),
    )
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow
    return { user: parse(user), created: true }
  })

  return run()
}

/**
 * If an existing user has no name (e.g. created before this default-from-email
 * fallback existed), populate it now from their email. Returns the (possibly
 * updated) row so callers can use it directly.
 */
function backfill_name_if_missing(db: Database.Database, row: UserRow): UserRow {
  if (row.name && row.name.trim().length > 0)
    return row
  const fallback = default_name_from_email(row.email)
  if (!fallback)
    return row
  db.prepare('UPDATE users SET name = ?, updated_at = strftime(\'%Y-%m-%dT%H:%M:%fZ\', \'now\') WHERE id = ?').run(fallback, row.id)
  return { ...row, name: fallback }
}

if (import.meta.vitest) {
  const { open_shared_db } = await import('$lib/db/server/shared-db')

  describe(default_name_from_email, () => {
    it('returns the local part of an email', () => {
      expect(default_name_from_email('jwrunner7@gmail.com')).toBe('jwrunner7')
    })
    it('handles plus-addressing in the local part', () => {
      expect(default_name_from_email('jacob+test@livingdictionaries.app')).toBe('jacob+test')
    })
    it('returns null for null/undefined/empty', () => {
      expect(default_name_from_email(null)).toBeNull()
      expect(default_name_from_email(undefined)).toBeNull()
      expect(default_name_from_email('')).toBeNull()
    })
  })

  describe(find_or_create_auth_user, () => {
    it('derives name from email on first login when no name supplied', () => {
      const db = open_shared_db(':memory:')
      const { user, created } = find_or_create_auth_user({
        db,
        provider: 'email',
        provider_id: 'jwrunner7@gmail.com',
        trusted_email: 'jwrunner7@gmail.com',
        new_user: { email: 'jwrunner7@gmail.com' },
      })
      expect(created).toBe(true)
      expect(user.name).toBe('jwrunner7')
      expect(user.email).toBe('jwrunner7@gmail.com')
      db.close()
    })

    it('prefers an explicit name over the email-derived fallback', () => {
      const db = open_shared_db(':memory:')
      const { user, created } = find_or_create_auth_user({
        db,
        provider: 'google',
        provider_id: 'g-123',
        trusted_email: 'someone@example.com',
        new_user: { email: 'someone@example.com', name: 'Some One' },
      })
      expect(created).toBe(true)
      expect(user.name).toBe('Some One')
      db.close()
    })

    it('backfills name on existing-identity login when previously null', () => {
      const db = open_shared_db(':memory:')
      // Seed a user without a name
      db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?)`)
        .run('u1', 'orphan@example.com', null, JSON.stringify([{ provider: 'email', provider_id: 'orphan@example.com' }]), '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')

      const { user, created } = find_or_create_auth_user({
        db,
        provider: 'email',
        provider_id: 'orphan@example.com',
        trusted_email: 'orphan@example.com',
        new_user: { email: 'orphan@example.com' },
      })
      expect(created).toBe(false)
      expect(user.name).toBe('orphan')
      db.close()
    })

    it('leaves a real name alone on existing-identity login', () => {
      const db = open_shared_db(':memory:')
      db.prepare(`INSERT INTO users (id, email, name, providers, created_at, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?)`)
        .run('u1', 'real@example.com', 'Real Name', JSON.stringify([{ provider: 'email', provider_id: 'real@example.com' }]), '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')

      const { user } = find_or_create_auth_user({
        db,
        provider: 'email',
        provider_id: 'real@example.com',
        trusted_email: 'real@example.com',
        new_user: { email: 'real@example.com' },
      })
      expect(user.name).toBe('Real Name')
      db.close()
    })
  })
}
