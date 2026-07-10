import type Database from 'better-sqlite3'
import { looks_like_email } from '$lib/utils/parse-email-list'
import { is_blocked_recipient } from '$lib/email/loop-protection'
import { error } from '@sveltejs/kit'
import { ResponseCodes } from '$lib/constants'

export interface ComposeRecipient {
  user_id: string | null
  email: string
  name: string | null
}

interface UserRow {
  id: string
  email: string | null
  name: string | null
}

export function resolve_user_by_email(db: Database.Database, email: string): UserRow | undefined {
  const normalized = email.trim().toLowerCase()
  const direct = db.prepare(
    `SELECT id, email, name FROM users WHERE LOWER(email) = ?`,
  ).get(normalized) as UserRow | undefined
  if (direct)
    return direct

  return db.prepare(`
    SELECT u.id, u.email, u.name
    FROM email_aliases ea
    JOIN users u ON u.id = ea.user_id
    WHERE LOWER(ea.email) = ?
  `).get(normalized) as UserRow | undefined
}

export interface SafeResolveResult {
  /** Resolved recipient, or null when resolution failed (see `error`). */
  recipient: ComposeRecipient | null
  /** Human-readable failure reason when `recipient` is null. */
  error: string | null
}

/**
 * Non-throwing recipient resolver — used by batch compose so one bad recipient
 * (unknown user, malformed/blocked email) surfaces as a per-recipient failure
 * rather than aborting the whole send. `resolve_compose_recipient` wraps this
 * for the single-recipient throwing contract.
 */
export function resolve_compose_recipient_safe({ db, to_user_id, to_email }: {
  db: Database.Database
  to_user_id?: string
  to_email?: string
}): SafeResolveResult {
  if (typeof to_user_id === 'string' && to_user_id.trim()) {
    const user = db.prepare(
      `SELECT id, email, name FROM users WHERE id = ?`,
    ).get(to_user_id.trim()) as UserRow | undefined
    if (!user)
      return { recipient: null, error: 'User not found' }
    if (!user.email)
      return { recipient: null, error: 'User has no email address on file' }
    if (is_blocked_recipient(user.email))
      return { recipient: null, error: `Refusing to send to blocked recipient: ${user.email}` }
    return { recipient: { user_id: user.id, email: user.email, name: user.name }, error: null }
  }

  if (typeof to_email === 'string' && to_email.trim()) {
    const email = to_email.trim().toLowerCase()
    if (!looks_like_email(email))
      return { recipient: null, error: `Invalid email address: ${to_email.trim()}` }
    if (is_blocked_recipient(email))
      return { recipient: null, error: `Refusing to send to blocked recipient: ${email}` }
    const matched = resolve_user_by_email(db, email)
    if (matched?.email)
      return { recipient: { user_id: matched.id, email: matched.email, name: matched.name }, error: null }
    return { recipient: { user_id: null, email, name: null }, error: null }
  }

  return { recipient: null, error: 'to_user_id or to_email is required' }
}

export function resolve_compose_recipient(args: {
  db: Database.Database
  to_user_id?: string
  to_email?: string
}): ComposeRecipient {
  const result = resolve_compose_recipient_safe(args)
  if (!result.recipient) {
    const status = result.error === 'User not found'
      ? ResponseCodes.NOT_FOUND
      : ResponseCodes.BAD_REQUEST
    error(status, result.error ?? 'recipient resolution failed')
  }
  return result.recipient
}

export function assert_recipient_allowed(email: string): void {
  if (is_blocked_recipient(email))
    error(ResponseCodes.BAD_REQUEST, `Refusing to send to blocked recipient: ${email}`)
}

export function assert_optional_recipients_allowed(emails: string[] | undefined): void {
  for (const email of emails ?? [])
    assert_recipient_allowed(email)
}

if (import.meta.vitest) {
  let db: Database.Database

  beforeEach(async () => {
    const { open_test_shared_db } = await import('$lib/db/server/shared-db')
    db = open_test_shared_db()
    const now = '2026-01-01T00:00:00.000Z'
    db.prepare('INSERT INTO users (id, email, name, providers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run('u-1', 'customer@example.com', 'Customer', '[]', now, now)
    db.prepare('INSERT INTO email_aliases (email, user_id, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run('alias@example.com', 'u-1', 'manual', now, now)
  })

  afterEach(() => {
    db.close()
  })

  describe(resolve_user_by_email, () => {
    test('finds by users.email', () => {
      expect(resolve_user_by_email(db, 'customer@example.com')?.id).toBe('u-1')
    })

    test('finds by email_aliases', () => {
      expect(resolve_user_by_email(db, 'alias@example.com')?.id).toBe('u-1')
    })
  })

  describe(resolve_compose_recipient, () => {
    test('resolves to_user_id', () => {
      expect(resolve_compose_recipient({ db, to_user_id: 'u-1' })).toEqual({
        user_id: 'u-1',
        email: 'customer@example.com',
        name: 'Customer',
      })
    })

    test('resolves typed email to linked user when known', () => {
      expect(resolve_compose_recipient({ db, to_email: 'alias@example.com' })).toEqual({
        user_id: 'u-1',
        email: 'customer@example.com',
        name: 'Customer',
      })
    })

    test('allows stranger email with null user_id', () => {
      expect(resolve_compose_recipient({ db, to_email: 'stranger@example.com' })).toEqual({
        user_id: null,
        email: 'stranger@example.com',
        name: null,
      })
    })
  })
}
