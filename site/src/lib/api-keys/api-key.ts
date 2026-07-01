import type Database from 'better-sqlite3'
import { createHash, randomBytes } from 'node:crypto'

/**
 * Per-dictionary API keys for the agent-friendly `/api/v1` write API.
 *
 * Server-only (better-sqlite3 against shared.db). The raw token is shown ONCE
 * on creation; we store only its sha-256 hash. A key is scoped to one
 * dictionary and grants either 'read' or 'read & write' access (default
 * 'write'); writes made with it are attributed to `created_by_user_id` (the
 * human who minted it).
 *
 * Token shape: `ldk_<43-char base64url of 32 random bytes>`. The `ldk_` prefix
 * lets the auth layer detect an API key vs a JWT at a glance.
 */

export const API_KEY_PREFIX = 'ldk_'

export type ApiKeyRole = 'read' | 'write'

export interface MintedApiKey {
  /** The full raw token — returned to the caller ONCE, never stored. */
  token: string
  token_hash: string
  /** Leading chars safe to persist/display, e.g. `ldk_a1b2c3`. */
  token_prefix: string
  /** Trailing 4 chars for display. */
  last_four: string
}

export interface ApiKeyRecord {
  id: string
  dictionary_id: string
  token_prefix: string
  last_four: string
  label: string
  role: ApiKeyRole
  created_by_user_id: string | null
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export interface VerifiedApiKey {
  key_id: string
  dictionary_id: string
  role: ApiKeyRole
  created_by_user_id: string | null
}

export function hash_api_key(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Generate a fresh token + the derived hash/display fields. */
export function generate_api_key(): MintedApiKey {
  const random = randomBytes(32).toString('base64url')
  const token = `${API_KEY_PREFIX}${random}`
  return {
    token,
    token_hash: hash_api_key(token),
    token_prefix: token.slice(0, API_KEY_PREFIX.length + 6),
    last_four: token.slice(-4),
  }
}

/** Insert a new key. Returns the record PLUS the one-time raw token. */
export function create_api_key({ db, dictionary_id, label, role = 'write', created_by_user_id }: {
  db: Database.Database
  dictionary_id: string
  label: string
  role?: ApiKeyRole
  created_by_user_id: string | null
}): { record: ApiKeyRecord, token: string } {
  const minted = generate_api_key()
  const id = crypto.randomUUID()
  const created_at = new Date().toISOString()
  db.prepare(`
    INSERT INTO api_keys
      (id, dictionary_id, token_hash, token_prefix, last_four, label, role, created_by_user_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, dictionary_id, minted.token_hash, minted.token_prefix, minted.last_four, label, role, created_by_user_id, created_at)

  const record: ApiKeyRecord = {
    id,
    dictionary_id,
    token_prefix: minted.token_prefix,
    last_four: minted.last_four,
    label,
    role,
    created_by_user_id,
    created_at,
    last_used_at: null,
    revoked_at: null,
  }
  return { record, token: minted.token }
}

/**
 * List a dictionary's ACTIVE keys (display fields only — never the hash).
 * Revoked keys are retained in the table for history attribution but excluded
 * here, so they never surface in any UI.
 */
export function list_api_keys({ db, dictionary_id }: {
  db: Database.Database
  dictionary_id: string
}): ApiKeyRecord[] {
  return db.prepare(`
    SELECT id, dictionary_id, token_prefix, last_four, label, role,
           created_by_user_id, created_at, last_used_at, revoked_at
    FROM api_keys
    WHERE dictionary_id = ? AND revoked_at IS NULL
    ORDER BY created_at DESC
  `).all(dictionary_id) as ApiKeyRecord[]
}

/**
 * Resolve a set of key ids to their display label + creator — for the change
 * history timeline. Includes REVOKED keys (the whole point of revoke-not-delete:
 * a past agent edit always resolves to a label + responsible human).
 */
export function resolve_api_keys({ db, key_ids }: {
  db: Database.Database
  key_ids: string[]
}): Record<string, { id: string, label: string, created_by_user_id: string | null }> {
  const out: Record<string, { id: string, label: string, created_by_user_id: string | null }> = {}
  const ids = [...new Set(key_ids.filter(Boolean))]
  if (!ids.length)
    return out
  const rows = db.prepare(
    `SELECT id, label, created_by_user_id FROM api_keys WHERE id IN (${ids.map(() => '?').join(',')})`,
  ).all(...ids) as { id: string, label: string, created_by_user_id: string | null }[]
  for (const row of rows)
    out[row.id] = row
  return out
}

/**
 * Revoke a key scoped to a dictionary (soft kill-switch). The row is RETAINED
 * forever so its id keeps resolving in change history; `verify_api_key` rejects
 * a revoked token. Returns whether an active key was revoked.
 */
export function revoke_api_key({ db, dictionary_id, key_id }: {
  db: Database.Database
  dictionary_id: string
  key_id: string
}): boolean {
  const info = db.prepare(
    `UPDATE api_keys SET revoked_at = ? WHERE id = ? AND dictionary_id = ? AND revoked_at IS NULL`,
  ).run(new Date().toISOString(), key_id, dictionary_id)
  return info.changes > 0
}

/** Hard-delete a key scoped to a dictionary. Returns whether a row was removed.
 *  Reserved for admin teardown / tests — normal removal goes through `revoke_api_key`. */
export function delete_api_key({ db, dictionary_id, key_id }: {
  db: Database.Database
  dictionary_id: string
  key_id: string
}): boolean {
  const info = db.prepare(
    `DELETE FROM api_keys WHERE id = ? AND dictionary_id = ?`,
  ).run(key_id, dictionary_id)
  return info.changes > 0
}

const LAST_USED_THROTTLE_MS = 60_000

/**
 * Resolve a raw token to its key record. Returns null when the token is
 * unknown or revoked. Touches `last_used_at` at most ~once/minute so hot
 * read/write paths don't hammer the row.
 */
export function verify_api_key({ db, token }: {
  db: Database.Database
  token: string
}): VerifiedApiKey | null {
  if (!token.startsWith(API_KEY_PREFIX))
    return null
  const token_hash = hash_api_key(token)
  const row = db.prepare(`
    SELECT id, dictionary_id, role, created_by_user_id, last_used_at, revoked_at
    FROM api_keys
    WHERE token_hash = ?
  `).get(token_hash) as (Pick<ApiKeyRecord, 'id' | 'dictionary_id' | 'role' | 'created_by_user_id' | 'last_used_at' | 'revoked_at'>) | undefined

  if (!row || row.revoked_at)
    return null

  const now = Date.now()
  const last = row.last_used_at ? new Date(row.last_used_at).getTime() : 0
  if (now - last > LAST_USED_THROTTLE_MS) {
    db.prepare(`UPDATE api_keys SET last_used_at = ? WHERE id = ?`)
      .run(new Date(now).toISOString(), row.id)
  }

  return {
    key_id: row.id,
    dictionary_id: row.dictionary_id,
    role: row.role,
    created_by_user_id: row.created_by_user_id,
  }
}
