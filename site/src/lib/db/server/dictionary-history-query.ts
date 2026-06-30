import type Database from 'better-sqlite3'
import { resolve_api_keys } from '$lib/api-keys/api-key'

/**
 * Read side of the change-history log. Pure over two better-sqlite3 handles
 * (the per-dict history db + shared.db for user names + agent key labels) so
 * it's unit-testable with in-memory dbs; the `GET /api/dictionary/[id]/history`
 * route only adds the auth gate on top.
 */

export type HistoryActor = 'all' | 'humans' | 'agents'

export interface HistoryQueryOptions {
  /** Owner-scoped timeline. Omit (or pass feed=true) for the dict-wide feed. */
  owner_type?: string
  owner_id?: string
  feed?: boolean
  /** Keyset cursor: return rows with rowid < this (older). */
  before?: number
  /** Page size (clamped 1..200, default 50). */
  limit?: number
  /** Filter by who acted: humans (no key), agents (api_key_id set), or all. */
  actor?: HistoryActor
}

export interface HistoryChange {
  id: string
  table_name: string
  row_id: string
  op: string
  user_id: string
  at: string
  snapshot: Record<string, unknown> | null
  delta: Record<string, unknown> | null
  /** The acting agent's API key id; null = a human edited directly. */
  api_key_id: string | null
}

export interface HistoryApiKey {
  id: string
  label: string
  created_by_user_id: string | null
}

export interface HistoryQueryResult {
  changes: HistoryChange[]
  users: Record<string, { id: string, name: string | null, email: string | null }>
  /** Agent (API key) labels for changes carrying an api_key_id. */
  api_keys: Record<string, HistoryApiKey>
  /** Pass back as `before` to fetch the next (older) page; null when exhausted. */
  cursor: number | null
}

export function query_history(
  history_db: Database.Database,
  shared_db: Database.Database,
  opts: HistoryQueryOptions,
): HistoryQueryResult {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200)
  const is_feed = opts.feed || !opts.owner_type || !opts.owner_id

  const where: string[] = []
  const params: (string | number)[] = []
  let from = 'FROM changes c'
  if (!is_feed) {
    from = 'FROM changes c JOIN change_owners o ON o.change_id = c.id'
    where.push('o.owner_type = ?', 'o.owner_id = ?')
    params.push(opts.owner_type!, opts.owner_id!)
  }
  if (opts.actor === 'agents')
    where.push('c.api_key_id IS NOT NULL')
  else if (opts.actor === 'humans')
    where.push('c.api_key_id IS NULL')
  if (opts.before !== undefined && !Number.isNaN(opts.before)) {
    where.push('c.rowid < ?')
    params.push(opts.before)
  }
  const where_sql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  // Fetch one extra row to detect a next page without a trailing empty request.
  const fetched = history_db.prepare(
    `SELECT c.rowid AS rowid, c.id, c.table_name, c.row_id, c.op, c.user_id, c.at, c.snapshot, c.delta, c.api_key_id
       ${from} ${where_sql}
       ORDER BY c.rowid DESC
       LIMIT ?`,
  ).all(...params, limit + 1) as (HistoryChange & { rowid: number, snapshot: string, delta: string | null })[]

  const has_more = fetched.length > limit
  const raw = has_more ? fetched.slice(0, limit) : fetched

  const changes: HistoryChange[] = raw.map(r => ({
    id: r.id,
    table_name: r.table_name,
    row_id: r.row_id,
    op: r.op,
    user_id: r.user_id,
    at: r.at,
    snapshot: safe_parse(r.snapshot),
    delta: safe_parse(r.delta),
    api_key_id: r.api_key_id ?? null,
  }))

  const cursor = has_more ? raw[raw.length - 1].rowid : null

  // Resolve agent key labels (incl. revoked) from shared.db.
  const api_keys = resolve_api_keys({ db: shared_db, key_ids: raw.map(r => r.api_key_id ?? '') })

  // Resolve editor display names from shared.db — both the change authors and
  // the agents' creators (so "🤖 Foo · on behalf of <human>" always resolves).
  const users: HistoryQueryResult['users'] = {}
  const ids = [...new Set([
    ...raw.map(r => r.user_id),
    ...Object.values(api_keys).map(k => k.created_by_user_id ?? ''),
  ].filter(Boolean))]
  if (ids.length) {
    const rows = shared_db.prepare(
      `SELECT id, name, email FROM users WHERE id IN (${ids.map(() => '?').join(',')})`,
    ).all(...ids) as { id: string, name: string | null, email: string | null }[]
    for (const u of rows)
      users[u.id] = u
  }

  return { changes, users, api_keys, cursor }
}

function safe_parse(value: string | null): Record<string, unknown> | null {
  if (!value)
    return null
  try {
    return JSON.parse(value) as Record<string, unknown>
  } catch {
    return null
  }
}
