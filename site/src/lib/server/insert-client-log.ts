import type Database from 'better-sqlite3'
import type { ClientLogLevel } from '$lib/db/schemas/shared.types'
import type { RequestGeo } from './geo-from-request'
import { get_logs_db, open_logs_db } from '$lib/db/server/logs-db'
import { EMPTY_GEO } from './geo-from-request'

/**
 * One client-side log entry as accepted by `POST /api/log`. Fields beyond
 * `level` + `message` are optional — clients may skip anything they don't
 * have. Validation is best-effort: malformed entries are dropped silently
 * because logging must never spawn more errors.
 */
export interface ClientLogPayload {
  level: ClientLogLevel
  message: string
  client_time?: string
  stack?: string | null
  url?: string | null
  user_agent?: string | null
  platform?: 'web' | 'ios' | 'android' | null
  app_version?: string | null
  build_target?: string | null
  /** Free-form JSON; the helper stringifies, agent triage parses. */
  context?: Record<string, unknown> | null
}

const VALID_LEVELS: ReadonlySet<ClientLogLevel> = new Set([
  'error',
  'warn',
  'info',
  'unhandled_rejection',
  'crash',
])

const MAX_MESSAGE_LEN = 2000
const MAX_STACK_LEN = 16_000
const MAX_CONTEXT_LEN = 16_000

function clamp(value: string | null | undefined, max: number): string | null {
  if (value === null || value === undefined)
    return null
  return value.length > max ? value.slice(0, max) : value
}

/**
 * Insert one client log into `logs.db` (the hot telemetry store, split out of
 * shared.db 2026-07-05). Returns `true` on success and `false` on any failure
 * (validation or DB) so callers can count accepted vs dropped without try/catch
 * boilerplate. Errors surface to the server console for operator visibility but
 * never re-throw.
 */
export function insert_client_log({
  payload,
  user_id,
  source = 'client',
  geo = EMPTY_GEO,
  db = get_logs_db(),
  now = new Date(),
}: {
  payload: ClientLogPayload
  user_id: string | null
  /** Where the entry came from. Browser POSTs are `'client'`; server telemetry is `'server'`. */
  source?: 'client' | 'server'
  /** Approximate location from CF edge headers (server-side). All-null for server telemetry / dev. */
  geo?: RequestGeo
  db?: Database.Database
  now?: Date
}): boolean {
  try {
    if (!payload || typeof payload !== 'object')
      return false
    if (!payload.message || typeof payload.message !== 'string')
      return false
    if (!VALID_LEVELS.has(payload.level))
      return false

    const id = crypto.randomUUID()
    const received_at = now.toISOString()
    const message = clamp(payload.message, MAX_MESSAGE_LEN) ?? ''
    const stack = clamp(payload.stack, MAX_STACK_LEN)
    const context_json = payload.context
      ? stringify_context_capped(payload.context)
      : null
    // Promote context.session_id to a real column so analytics filters/groups on
    // it directly (never a per-row json_extract — the old hot-path cost).
    const session_id = typeof payload.context?.session_id === 'string' ? payload.context.session_id : null
    // Same for the persistent, cookieless visitor id (one per browser across days)
    // — the raw material for unique-VISITOR counts (vs session_id's per-load visits).
    const visitor_id = typeof payload.context?.visitor_id === 'string' ? payload.context.visitor_id : null

    db.prepare(`
      INSERT INTO client_logs (
        id, received_at, client_time, user_id, level, message, stack,
        url, user_agent, platform, app_version, build_target, context, source,
        session_id, visitor_id, country, region, city, latitude, longitude
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      received_at,
      payload.client_time ?? null,
      user_id,
      payload.level,
      message,
      stack,
      payload.url ?? null,
      payload.user_agent ?? null,
      payload.platform ?? null,
      payload.app_version ?? null,
      payload.build_target ?? null,
      context_json,
      source,
      session_id,
      visitor_id,
      geo.country,
      geo.region,
      geo.city,
      geo.latitude,
      geo.longitude,
    )
    return true
  } catch (err) {
    console.error('[insert_client_log] failed:', (err as Error).message)
    return false
  }
}

function safe_stringify(value: unknown): string | null {
  try {
    return JSON.stringify(value)
  } catch {
    return null
  }
}

/**
 * Serialize `context` to JSON that is ALWAYS valid and never longer than
 * `MAX_CONTEXT_LEN`. A blind `.slice()` on the serialized string used to cut
 * JSON mid-token, persisting invalid JSON that then 500-ed every unguarded
 * `json_extract(context, …)` in the analytics dashboards. Instead of slicing,
 * we replace the largest top-level fields with a short marker until the object
 * fits — the small, useful fields (session_id, code, route…) survive intact.
 */
function stringify_context_capped(context: Record<string, unknown>): string | null {
  const full = safe_stringify(context)
  if (full === null)
    return null
  if (full.length <= MAX_CONTEXT_LEN)
    return full

  // Rank top-level fields by serialized size and replace the biggest ones with
  // a marker until the whole object fits. Re-stringify + re-check each step so
  // we stop as soon as we're under the cap.
  const fields = Object.entries(context)
    .map(([key, value]) => ({ key, size: (safe_stringify(value) ?? 'null').length }))
    .sort((first, second) => second.size - first.size)

  const capped: Record<string, unknown> = { ...context, _context_truncated: true }
  for (const field of fields) {
    const current = safe_stringify(capped)
    if (current !== null && current.length <= MAX_CONTEXT_LEN)
      return current
    capped[field.key] = `[truncated: ${field.size} chars]`
  }

  // Every field replaced and still over cap (e.g. thousands of tiny keys) —
  // fall back to a minimal valid marker rather than persist invalid JSON.
  const result = safe_stringify(capped)
  if (result !== null && result.length <= MAX_CONTEXT_LEN)
    return result
  return JSON.stringify({ _context_truncated: true, _reason: 'context exceeded max length' })
}

/**
 * Tiny in-process IP rate limiter — token bucket per remote address. We don't
 * need anything sophisticated: this is a guard against a runaway client
 * looping logs, not abuse mitigation. State lives on `globalThis` so HMR in
 * dev doesn't reset the bucket between edits.
 */
const RATE_KEY = Symbol.for('living:client-log-rate-buckets')
interface Bucket { tokens: number, last_refill_ms: number }
interface RateState { buckets: Map<string, Bucket>, last_purge_ms: number }

function get_rate_state(): RateState {
  const global_object = globalThis as unknown as Record<symbol, RateState | undefined>
  if (!global_object[RATE_KEY])
    global_object[RATE_KEY] = { buckets: new Map(), last_purge_ms: Date.now() }
  return global_object[RATE_KEY] as RateState
}

const RATE_CAPACITY = 30 // burst
const RATE_REFILL_PER_MS = 30 / 60_000 // 30 logs per minute steady-state
const PURGE_INTERVAL_MS = 5 * 60_000

/**
 * Returns `true` if the IP is allowed to log right now (and consumes a token);
 * `false` if it's over the cap. Use `now_ms` injection for deterministic tests.
 */
export function rate_limit_allow({ ip, now_ms = Date.now() }: { ip: string, now_ms?: number }): boolean {
  const state = get_rate_state()

  // Periodic purge so a long-running process doesn't leak per-IP buckets forever.
  if (now_ms - state.last_purge_ms > PURGE_INTERVAL_MS) {
    for (const [key, bucket] of state.buckets) {
      const refilled = Math.min(RATE_CAPACITY, bucket.tokens + (now_ms - bucket.last_refill_ms) * RATE_REFILL_PER_MS)
      if (refilled >= RATE_CAPACITY)
        state.buckets.delete(key)
    }
    state.last_purge_ms = now_ms
  }

  let bucket = state.buckets.get(ip)
  if (!bucket) {
    bucket = { tokens: RATE_CAPACITY, last_refill_ms: now_ms }
    state.buckets.set(ip, bucket)
  } else {
    const elapsed_ms = now_ms - bucket.last_refill_ms
    bucket.tokens = Math.min(RATE_CAPACITY, bucket.tokens + elapsed_ms * RATE_REFILL_PER_MS)
    bucket.last_refill_ms = now_ms
  }

  if (bucket.tokens < 1)
    return false
  bucket.tokens -= 1
  return true
}

/** Test-only: reset all rate buckets between tests. */
export function _reset_rate_state(): void {
  const state = get_rate_state()
  state.buckets.clear()
  state.last_purge_ms = Date.now()
}

if (import.meta.vitest) {
  describe(insert_client_log, () => {
    test('inserts a minimal valid payload', () => {
      const db = open_logs_db(':memory:')
      const ok = insert_client_log({ payload: { level: 'error', message: 'boom' }, user_id: null, db })
      expect(ok).toBe(true)
      const row = db.prepare('SELECT level, message, user_id FROM client_logs').get() as { level: string, message: string, user_id: string | null }
      expect(row.level).toBe('error')
      expect(row.message).toBe('boom')
      expect(row.user_id).toBeNull()
    })

    test('attributes user_id when provided', () => {
      const db = open_logs_db(':memory:')
      insert_client_log({ payload: { level: 'crash', message: 'died' }, user_id: 'u-7', db })
      const row = db.prepare('SELECT user_id FROM client_logs').get() as { user_id: string }
      expect(row.user_id).toBe('u-7')
    })

    test('defaults source to client; honors an explicit server source', () => {
      const db = open_logs_db(':memory:')
      insert_client_log({ payload: { level: 'info', message: 'from-browser' }, user_id: null, db })
      insert_client_log({ payload: { level: 'error', message: 'from-server' }, user_id: null, source: 'server', db })
      const rows = db.prepare('SELECT message, source FROM client_logs ORDER BY message').all() as { message: string, source: string }[]
      expect(rows).toEqual([
        { message: 'from-browser', source: 'client' },
        { message: 'from-server', source: 'server' },
      ])
    })

    test('stamps geo columns when provided, and leaves them null otherwise', () => {
      const db = open_logs_db(':memory:')
      insert_client_log({
        payload: { level: 'info', message: 'session_start' },
        user_id: null,
        geo: { country: 'US', region: 'CA', city: 'Los Angeles', latitude: 34.05, longitude: -118.24 },
        db,
      })
      insert_client_log({ payload: { level: 'info', message: 'no-geo' }, user_id: null, db })
      const rows = db.prepare('SELECT message, country, region, city, latitude, longitude FROM client_logs ORDER BY message').all() as Record<string, unknown>[]
      expect(rows[0]).toEqual({ message: 'no-geo', country: null, region: null, city: null, latitude: null, longitude: null })
      expect(rows[1]).toEqual({ message: 'session_start', country: 'US', region: 'CA', city: 'Los Angeles', latitude: 34.05, longitude: -118.24 })
    })

    test('stringifies context to JSON in storage', () => {
      const db = open_logs_db(':memory:')
      insert_client_log({
        payload: { level: 'error', message: 'x', context: { route: '/admin/messages', breadcrumbs: ['a', 'b'] } },
        user_id: null,
        db,
      })
      const row = db.prepare('SELECT context FROM client_logs').get() as { context: string }
      expect(JSON.parse(row.context)).toEqual({ route: '/admin/messages', breadcrumbs: ['a', 'b'] })
    })

    test('promotes context.session_id to the real session_id column', () => {
      const db = open_logs_db(':memory:')
      insert_client_log({ payload: { level: 'info', message: 'session_start', context: { session_id: 'sess-9', breadcrumbs: [] } }, user_id: null, db })
      insert_client_log({ payload: { level: 'info', message: 'no-session', context: { foo: 'bar' } }, user_id: null, db })
      const rows = db.prepare('SELECT message, session_id FROM client_logs ORDER BY message').all() as { message: string, session_id: string | null }[]
      expect(rows).toEqual([
        { message: 'no-session', session_id: null },
        { message: 'session_start', session_id: 'sess-9' },
      ])
    })

    test('promotes context.visitor_id to the real visitor_id column', () => {
      const db = open_logs_db(':memory:')
      insert_client_log({ payload: { level: 'info', message: 'session_start', context: { visitor_id: 'vis-42', session_id: 's1' } }, user_id: null, db })
      insert_client_log({ payload: { level: 'info', message: 'no-visitor', context: { foo: 'bar' } }, user_id: null, db })
      const rows = db.prepare('SELECT message, visitor_id FROM client_logs ORDER BY message').all() as { message: string, visitor_id: string | null }[]
      expect(rows).toEqual([
        { message: 'no-visitor', visitor_id: null },
        { message: 'session_start', visitor_id: 'vis-42' },
      ])
    })

    test('rejects payloads missing level or message', () => {
      const db = open_logs_db(':memory:')
      // @ts-expect-error — testing invalid payload
      expect(insert_client_log({ payload: { message: 'no level' }, user_id: null, db })).toBe(false)
      // @ts-expect-error — testing invalid payload
      expect(insert_client_log({ payload: { level: 'error' }, user_id: null, db })).toBe(false)
      const count = (db.prepare('SELECT COUNT(*) AS c FROM client_logs').get() as { c: number }).c
      expect(count).toBe(0)
    })

    test('rejects unknown levels', () => {
      const db = open_logs_db(':memory:')
      // @ts-expect-error — testing invalid level
      expect(insert_client_log({ payload: { level: 'fatal', message: 'x' }, user_id: null, db })).toBe(false)
    })

    test('truncates oversize message and stack', () => {
      const db = open_logs_db(':memory:')
      const huge_message = 'x'.repeat(MAX_MESSAGE_LEN + 100)
      const huge_stack = 'y'.repeat(MAX_STACK_LEN + 100)
      insert_client_log({
        payload: { level: 'error', message: huge_message, stack: huge_stack },
        user_id: null,
        db,
      })
      const row = db.prepare('SELECT message, stack FROM client_logs').get() as { message: string, stack: string }
      expect(row.message).toHaveLength(MAX_MESSAGE_LEN)
      expect(row.stack).toHaveLength(MAX_STACK_LEN)
    })

    test('truncates oversize context to VALID JSON rather than slicing mid-token', () => {
      const db = open_logs_db(':memory:')
      // A giant log_tail array — the exact shape (a big sync_failed context) that
      // used to overflow 16 KB and get sliced into invalid JSON.
      const huge_tail = Array.from({ length: 6000 }, (_, index) => `event-${index}-with-some-padding-text`)
      const ok = insert_client_log({
        payload: { level: 'error', message: 'sync_failed', context: { code: 'FK_FAIL', session_id: 's-1', log_tail: huge_tail } },
        user_id: null,
        db,
      })
      expect(ok).toBe(true)
      const row = db.prepare('SELECT context, session_id FROM client_logs').get() as { context: string, session_id: string | null }
      expect(row.context.length <= MAX_CONTEXT_LEN).toBe(true)
      // The whole point: what we persisted parses as valid JSON.
      const parsed = JSON.parse(row.context) as Record<string, unknown>
      expect(parsed._context_truncated).toBe(true)
      expect(parsed.code).toBe('FK_FAIL') // small fields survive intact
      expect(typeof parsed.log_tail).toBe('string') // the oversized field is replaced by a marker
      expect(row.session_id).toBe('s-1') // promotion still works
    })

    test('survives a context object containing a circular reference', () => {
      const db = open_logs_db(':memory:')
      const cyclic: Record<string, unknown> = { a: 1 }
      cyclic.self = cyclic
      const ok = insert_client_log({
        payload: { level: 'error', message: 'cyclic', context: cyclic },
        user_id: null,
        db,
      })
      expect(ok).toBe(true)
      const row = db.prepare('SELECT context FROM client_logs').get() as { context: string | null }
      expect(row.context).toBeNull()
    })
  })

  describe(rate_limit_allow, () => {
    test('allows up to RATE_CAPACITY immediate calls per IP, then blocks', () => {
      _reset_rate_state()
      const ip = '1.2.3.4'
      let allowed = 0
      for (let index = 0; index < RATE_CAPACITY + 5; index++) {
        if (rate_limit_allow({ ip, now_ms: 1000 }))
          allowed++
      }
      expect(allowed).toBe(RATE_CAPACITY)
    })

    test('refills tokens at the configured steady-state rate', () => {
      _reset_rate_state()
      const ip = '5.6.7.8'
      for (let index = 0; index < RATE_CAPACITY; index++)
        rate_limit_allow({ ip, now_ms: 1000 })
      expect(rate_limit_allow({ ip, now_ms: 1000 })).toBe(false)

      // 30s later, ~15 tokens should have refilled (30 / minute) — enough to unblock.
      expect(rate_limit_allow({ ip, now_ms: 1000 + 30_000 })).toBe(true)
    })

    test('tracks separate buckets per IP', () => {
      _reset_rate_state()
      for (let index = 0; index < RATE_CAPACITY; index++)
        rate_limit_allow({ ip: 'a', now_ms: 0 })
      expect(rate_limit_allow({ ip: 'a', now_ms: 0 })).toBe(false)
      expect(rate_limit_allow({ ip: 'b', now_ms: 0 })).toBe(true)
    })
  })
}
