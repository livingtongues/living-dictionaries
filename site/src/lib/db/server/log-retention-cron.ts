import type Database from 'better-sqlite3'
import { building, dev } from '$app/environment'
import { env } from '$env/dynamic/private'
import { is_noise_error_message } from '$lib/debug/classify-error'
import { DICTIONARY_OPENED } from '$lib/debug/log-events'
import { is_bot_user_agent } from '$lib/debug/parse-user-agent'
import { geo_key } from '$lib/server/geo-from-request'
import { log_server_event } from '$lib/server/log-server-event'
import { get_admin_user_ids } from './admin-user-ids'
import type { SessionActivity } from './bot-sessions'
import { classify_ua_frequency_bot_sessions } from './bot-sessions'
import { get_log_archive_db } from './log-archive-db'
import { CLIENT_LOG_COLUMNS, get_logs_db } from './logs-db'
import { get_shared_db } from './shared-db'

/**
 * Two-tier log retention + a forever daily rollup.
 *
 *   - rollup_day()      aggregates a day's `client_logs` (from `logs.db`) into
 *                       shared.db's `log_daily_metrics` + `log_daily_sessions`
 *                       (idempotent full-day REPLACE) so trends outlive the raw rows.
 *   - archive_old_logs() moves rows older than HOT_WINDOW_DAYS from `logs.db`
 *                       into `logs-archive.db`, then prunes the archive past
 *                       ARCHIVE_WINDOW_DAYS.
 *
 * A `log_rollup_finalized_through` watermark (db_metadata) marks the last
 * COMPLETED day whose rollup ran after the day ended — those days' rows are
 * immutable (received_at is server-stamped at insert), so each sweep only
 * re-rolls days past the watermark (usually just today) instead of re-parsing
 * the whole hot window. The analytics reader trusts rollups up to the watermark
 * and scans raw rows live only for days beyond it. Singleton-guarded; always
 * runs on the active node (only IS_STANDBY + dev/build gated — no enable flag).
 */

const HOT_WINDOW_DAYS = 14
const ARCHIVE_WINDOW_DAYS = 60
const DAY_MS = 24 * 60 * 60 * 1000
const RETENTION_INTERVAL_MS = 6 * 60 * 60 * 1000 // sweep every 6h; self-heals a missed window same-day

const ERROR_LEVELS = new Set(['error', 'unhandled_rejection', 'crash'])
const TOP_LEVEL_ROUTES = new Set(['dictionaries', 'about', 'tutorials', 'account', 'create-dictionary', 'admin', 'terms'])

/** Collapse a pathname into a bounded route bucket so `nav:*` metrics don't explode in cardinality. */
export function normalize_route(pathname: string | null | undefined): string {
  if (!pathname)
    return 'unknown'
  if (pathname === '/')
    return 'home'
  const segments = pathname.split('/').filter(Boolean)
  const [top = ''] = segments
  if (TOP_LEVEL_ROUTES.has(top))
    return top
  // Otherwise a per-dictionary route: /[dictionaryId]/(entries[/entryId]|settings|about|…)
  const [, sub, third] = segments
  if (!sub)
    return 'dictionary:home'
  if (sub === 'entries')
    return third ? 'dictionary:entry' : 'dictionary:entries'
  return `dictionary:${sub}`
}

interface AccumRow { source: string, level: string, message: string, user_id: string | null, context: string | null, session_id: string | null, visitor_id: string | null, browser_locale: string | null, country: string | null, region: string | null, user_agent: string | null }

/**
 * Aggregate one UTC day's `client_logs` (read from `logs.db`) into shared.db's
 * `log_daily_metrics` + `log_daily_sessions`. Idempotent full-day REPLACE: the
 * day's existing rows are DELETEd first, so re-running (e.g. for "today", still
 * accumulating) is safe AND a metric that stopped occurring can't linger as a
 * ghost (see the gotcha note on write_all).
 */
export function rollup_day({ day, shared_db = get_shared_db(), logs_db = get_logs_db() }: { day: string, shared_db?: Database.Database, logs_db?: Database.Database }): { metrics_written: number } {
  const rows = logs_db.prepare(`
    SELECT coalesce(source,'client') source, level, message, user_id, context, session_id, visitor_id, browser_locale, country, region, user_agent
    FROM client_logs WHERE substr(received_at, 1, 10) = ?
  `).all(day) as AccumRow[]

  interface Bucket {
    sessions: Set<string>
    users: Set<string>
    logs: number
    errors: number
    /** Errors that are NOT known-benign noise / expected 4xx — the same predicate the live dashboard applies. */
    real_errors: number
    levels: Map<string, number>
    events: Map<string, number>
    navs: Map<string, number>
    /** Distinct sessions per area key (`US-CA` / `US`). Forever "which areas have users". */
    geo: Map<string, Set<string>>
  }
  const make_bucket = (): Bucket => ({ sessions: new Set(), users: new Set(), logs: 0, errors: 0, real_errors: 0, levels: new Map(), events: new Map(), navs: new Map(), geo: new Map() })
  const by_source = new Map<string, Bucket>()
  const bucket_for = (source: string): Bucket => {
    let bucket = by_source.get(source)
    if (!bucket) {
      bucket = make_bucket()
      by_source.set(source, bucket)
    }
    return bucket
  }
  // Bots (crawlers / headless automation) go into a SEPARATE bucket emitted under
  // a `bot:` metric namespace, so /admin/analytics can toggle Humans (plain
  // metrics) vs Bots (`bot:` metrics) across the FULL window — including archived
  // days where the raw UA is gone. Bots are always a client row (server rows carry
  // no UA), so the bot bucket has no per-source split. Human metrics keep the
  // plain keys, so a day's human trend doesn't jump when it ages out of hot storage.
  const bot_bucket = make_bucket()
  const bump = (map: Map<string, number>, key: string): void => { map.set(key, (map.get(key) ?? 0) + 1) }

  // Pre-parse context once + build per-session activity so a session can be
  // classified as a UA-frequency crawler (spoofed-Chrome UAs the regex + webdriver
  // checks miss) — the SAME rule the live dashboard applies. All rows share `day`.
  interface ParsedRow { row: AccumRow, context: Record<string, unknown> | null, session_id: string | null }
  interface DailySessionAccum extends SessionActivity {
    db_tier: string | null
    country: string | null
    region: string | null
    /** First non-null signed-in user for the session — lets the reader exclude admin sessions from geo. */
    user_id: string | null
    /** Persistent per-browser id (first non-null) — the locale panels' unique-visitor key. */
    visitor_id: string | null
    /** Primary Accept-Language tag (server-stamped column; first non-null). */
    browser_locale: string | null
    /** Locale the UI rendered in — from `session_start` context. */
    ui_locale: string | null
  }
  const admin_user_ids = get_admin_user_ids({ shared_db })
  const parsed_rows: ParsedRow[] = []
  const session_activity = new Map<string, DailySessionAccum>()
  const webdriver_sessions = new Set<string>()
  for (const row of rows) {
    let context: Record<string, unknown> | null
    try { context = row.context ? JSON.parse(row.context) as Record<string, unknown> : null } catch { context = null }
    const session_id = row.session_id ?? null
    parsed_rows.push({ row, context, session_id })
    if (session_id) {
      let activity = session_activity.get(session_id)
      if (!activity) {
        activity = { session_id, day, user_agent: row.user_agent, heartbeats: 0, has_user_id: false, db_tier: null, country: null, region: null, user_id: null, visitor_id: null, browser_locale: null, ui_locale: null }
        session_activity.set(session_id, activity)
      }
      if (!activity.user_agent && row.user_agent)
        activity.user_agent = row.user_agent
      if (row.user_id) {
        activity.has_user_id = true
        activity.user_id ??= row.user_id
      }
      if (row.message === 'heartbeat')
        activity.heartbeats++
      if (context?.webdriver === true)
        webdriver_sessions.add(session_id)
      if (!activity.db_tier && typeof context?.db_tier === 'string')
        activity.db_tier = context.db_tier
      activity.visitor_id ??= row.visitor_id
      activity.browser_locale ??= row.browser_locale
      if (!activity.ui_locale && typeof context?.ui_locale === 'string')
        activity.ui_locale = context.ui_locale
      if (!activity.country && row.country) {
        activity.country = row.country
        activity.region = row.region
      }
    }
  }
  const freq_bot_sessions = classify_ua_frequency_bot_sessions({ sessions: [...session_activity.values()] })
  // Bot = crawler UA, automation (navigator.webdriver), OR a UA-frequency crawler.
  // Rows with no session_id (server rows) fall back to the UA check (null UA → human).
  const session_is_bot = (session_id: string): boolean => {
    const activity = session_activity.get(session_id)
    return (activity ? is_bot_user_agent(activity.user_agent) : false) || webdriver_sessions.has(session_id) || freq_bot_sessions.has(session_id)
  }
  // Admin (level >= 2) sessions — excluded from the geo area tally only (they skew
  // "where visitors come from"); still counted everywhere else.
  const admin_sessions = new Set<string>()
  for (const activity of session_activity.values()) {
    if (activity.user_id && admin_user_ids.has(activity.user_id))
      admin_sessions.add(activity.session_id)
  }

  // Per-dictionary viewership: distinct HUMAN sessions that opened each dict today,
  // + the anon subset (session with no user_id ≈ outside public visitor). One
  // `dictionary_opened` fires per dict-open (the [dictionaryId] layout mounts even
  // on a deep-linked entry), so this counts any entry into the dict. Bots excluded
  // via the same session_is_bot gate as the metric buckets. Written to the forever
  // `dictionary_daily_views` table (never pruned) — see the migration.
  // `sessions`/`anon` = distinct session_id (visits, reset per page-load). `visitors`/
  // `anon_visitors` = distinct persistent visitor_id (people/devices across days) —
  // falls back to session_id for pre-rollout rows with no visitor_id, so the count
  // never undercounts during the capture ramp-up.
  const dict_views = new Map<string, { sessions: Set<string>, anon: Set<string>, visitors: Set<string>, anon_visitors: Set<string> }>()
  // Agent-API entry edits (creates + updates + deletes), BULK-WEIGHTED: one
  // `v1_entries_written` row can carry thousands of entries in its context counts
  // (4,728 in the 2026-07-15 rusitene import), so the plain `event:` row-count
  // metric wildly undercounts. Feeds the forever UI-vs-API edits trend (the UI
  // side is already exact via `event:entry_created` / `event:entry_deleted`).
  let api_entry_edits = 0
  for (const { row, context, session_id } of parsed_rows) {
    const is_bot = session_id ? session_is_bot(session_id) : is_bot_user_agent(row.user_agent)
    const bucket = is_bot ? bot_bucket : bucket_for(row.source)
    if (row.source === 'server' && row.level === 'info') {
      if (row.message === 'v1_entries_written') {
        const created = typeof context?.created === 'number' ? context.created : 0
        const updated = typeof context?.updated === 'number' ? context.updated : 0
        api_entry_edits += created + updated
      } else if (row.message === 'v1_entry_updated' || row.message === 'v1_entry_deleted') {
        api_entry_edits++
      }
    }
    if (!is_bot && session_id && row.message === DICTIONARY_OPENED) {
      const dict_id = typeof context?.dictionary_id === 'string' ? context.dictionary_id : null
      if (dict_id) {
        let views = dict_views.get(dict_id)
        if (!views) {
          views = { sessions: new Set(), anon: new Set(), visitors: new Set(), anon_visitors: new Set() }
          dict_views.set(dict_id, views)
        }
        const visitor_key = row.visitor_id ?? session_id
        const is_anon = !session_activity.get(session_id)?.has_user_id
        views.sessions.add(session_id)
        views.visitors.add(visitor_key)
        if (is_anon) {
          views.anon.add(session_id)
          views.anon_visitors.add(visitor_key)
        }
      }
    }
    bucket.logs++
    if (ERROR_LEVELS.has(row.level)) {
      bucket.errors++
      const is_null_session_zombie = !session_id && (row.message === 'sync_failed' || row.message === 'leader_boot_failed')
      if (!is_noise_error_message(row.message) && !is_null_session_zombie)
        bucket.real_errors++
    }
    bump(bucket.levels, row.level)
    if (row.user_id)
      bucket.users.add(row.user_id)
    if (session_id) {
      bucket.sessions.add(session_id)
      const key = geo_key({ country: row.country, region: row.region })
      if (key) {
        let area = bucket.geo.get(key)
        if (!area) {
          area = new Set()
          bucket.geo.set(key, area)
        }
        area.add(session_id)
      }
    }
    if (row.level === 'info')
      bump(bucket.events, row.message)
    if (row.message === 'navigation')
      bump(bucket.navs, normalize_route(typeof context?.to === 'string' ? context.to : null))
  }

  const metrics: { metric: string, source: string, value: number }[] = []
  // `prefix` is '' for human/server buckets, 'bot:' for the bot bucket. NOTE: `users`
  // is emitted ONCE per day (cross-source distinct) below, NOT here per source — a
  // signed-in user with BOTH browser (client) and server-attributed rows the same day
  // would otherwise be counted once per source and summed to 2 in the daily line,
  // disagreeing with the live COUNT(DISTINCT user_id).
  const emit = (bucket: Bucket, source: string, prefix: string): void => {
    metrics.push({ metric: `${prefix}sessions`, source, value: bucket.sessions.size })
    metrics.push({ metric: `${prefix}logs`, source, value: bucket.logs })
    metrics.push({ metric: `${prefix}errors`, source, value: bucket.errors })
    metrics.push({ metric: `${prefix}real_errors`, source, value: bucket.real_errors })
    for (const [level, value] of bucket.levels)
      metrics.push({ metric: `${prefix}level:${level}`, source, value })
    for (const [event, value] of bucket.events)
      metrics.push({ metric: `${prefix}event:${event}`, source, value })
    for (const [route, value] of bucket.navs)
      metrics.push({ metric: `${prefix}nav:${route}`, source, value })
    for (const [area, sessions] of bucket.geo) {
      // Geo excludes admin sessions (skews "where visitors come from"); other metrics keep them.
      const visitors = [...sessions].filter(session_id => !admin_sessions.has(session_id)).length
      if (visitors > 0)
        metrics.push({ metric: `${prefix}geo:${area}`, source, value: visitors })
    }
  }
  for (const [source, bucket] of by_source)
    emit(bucket, source, '')
  // Cross-source distinct users, emitted once under a canonical `client` source so
  // build_daily reads a single `users` row (no per-source double count). The reader
  // sums `users` rollup rows per day, so exactly one row = the right total.
  const human_users = new Set<string>()
  for (const bucket of by_source.values()) {
    for (const user of bucket.users)
      human_users.add(user)
  }
  metrics.push({ metric: 'users', source: 'client', value: human_users.size })
  if (api_entry_edits > 0)
    metrics.push({ metric: 'api_entry_edits', source: 'server', value: api_entry_edits })
  // Only emit bot metrics when bots were actually seen (keeps quiet days lean).
  if (bot_bucket.logs > 0) {
    emit(bot_bucket, 'client', 'bot:')
    metrics.push({ metric: 'bot:users', source: 'client', value: bot_bucket.users.size })
  }

  const upsert = shared_db.prepare(`
    INSERT INTO log_daily_metrics (day, metric, source, value) VALUES (?, ?, ?, ?)
    ON CONFLICT(day, metric, source) DO UPDATE SET value = excluded.value
  `)
  // Materialize the day's per-session aggregates (ALL sessions, bots included —
  // the reader re-classifies from the stored UA/webdriver/heartbeats) so the
  // capability/geo panels never re-scan raw rows for finalized days.
  const insert_session = shared_db.prepare(`
    INSERT INTO log_daily_sessions (day, session_id, user_agent, heartbeats, has_user_id, webdriver, db_tier, country, region, user_id, visitor_id, browser_locale, ui_locale)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insert_dict_view = shared_db.prepare(`
    INSERT INTO dictionary_daily_views (day, dictionary_id, sessions, anon_sessions, visitors, anon_visitors)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const write_all = shared_db.transaction((items: typeof metrics) => {
    // Full-day REPLACE, not merge: without the delete, a metric that no longer
    // exists for the day (e.g. a UA reclassified as a bot) would keep its stale
    // value forever — upsert only overwrites keys that still occur. This "ghost
    // metric" bug lived in prod (house post-mortem) until the reader started
    // trusting rollups; the archived-days re-roll heals history.
    shared_db.prepare('DELETE FROM log_daily_metrics WHERE day = ?').run(day)
    for (const item of items)
      upsert.run(day, item.metric, item.source, item.value)
    shared_db.prepare('DELETE FROM log_daily_sessions WHERE day = ?').run(day)
    for (const session of session_activity.values()) {
      insert_session.run(
        day,
        session.session_id,
        session.user_agent,
        session.heartbeats,
        session.has_user_id ? 1 : 0,
        webdriver_sessions.has(session.session_id) ? 1 : null,
        session.db_tier,
        session.country,
        session.region,
        session.user_id,
        session.visitor_id,
        session.browser_locale,
        session.ui_locale,
      )
    }
    // Full-day REPLACE (same idempotency contract as the metrics/sessions above).
    shared_db.prepare('DELETE FROM dictionary_daily_views WHERE day = ?').run(day)
    for (const [dict_id, views] of dict_views)
      insert_dict_view.run(day, dict_id, views.sessions.size, views.anon.size, views.visitors.size, views.anon_visitors.size)
  })
  write_all(metrics)
  return { metrics_written: metrics.length }
}

/** Sentinel `scope` for the whole-site combined monthly-visitor row. */
export const SITE_SCOPE = '__site__'
/** The `client_logs.message` emitted once per page-load/session boot (remote-log init). */
export const SESSION_START = 'session_start'
/** db_metadata key: the last COMPLETE calendar month whose monthly-visitor rollup is frozen ('YYYY-MM'). */
export const MONTHLY_FINALIZED_KEY = 'monthly_visitors_finalized_through'

/** 'YYYY-MM' UTC month for a date. */
export function month_string(date: Date): string {
  return date.toISOString().slice(0, 7)
}
/** The calendar month before `month` ('YYYY-MM'). */
export function prev_month(month: string): string {
  const [year, mon] = month.split('-').map(Number)
  return month_string(new Date(Date.UTC(year, mon - 2, 1)))
}
/** The calendar month after `month` ('YYYY-MM'). */
function next_month(month: string): string {
  const [year, mon] = month.split('-').map(Number)
  return month_string(new Date(Date.UTC(year, mon, 1)))
}

interface ScopeAccum { visits: Set<string>, anon_visits: Set<string>, visitors: Set<string>, anon_visitors: Set<string> }

/**
 * Roll one CALENDAR MONTH's raw `client_logs` (hot logs.db ∪ archive) into the
 * forever `dictionary_monthly_visitors` table — the UNION of distinct visitor_ids
 * over the WHOLE month (TRUE monthly uniques), vs `dictionary_daily_views`'s
 * daily-distinct (which summed = "visitor-days", overcounting). Idempotent
 * full-month DELETE + INSERT, so re-running the in-progress current month is safe.
 *
 * Two scope kinds: each `dictionary_id` (distinct visitors who OPENED that dict,
 * from `dictionary_opened`) + `__site__` (distinct visitors who started ANY
 * session, from `session_start` — one visitor across many dicts is ONE site
 * visitor, so it is NOT the sum of the per-dict rows). Bots are excluded using the
 * SAME UA + webdriver + per-day-frequency classifier as the daily rollup, sourced
 * from the forever `log_daily_sessions` materialization (survives the raw prune).
 * Anonymity is session-level (`has_user_id` from log_daily_sessions), matching the
 * daily rollup. `visitor_id` falls back to `session_id` for pre-2026-07-07 rows.
 */
export function rollup_month({ month, shared_db = get_shared_db(), logs_db = get_logs_db(), archive_db = get_log_archive_db() }: {
  month: string
  shared_db?: Database.Database
  logs_db?: Database.Database
  archive_db?: Database.Database
}): { scopes_written: number } {
  const month_start_iso = `${month}-01T00:00:00.000Z`
  const month_end_iso = `${next_month(month)}-01T00:00:00.000Z`

  // Bot sessions + per-session anon flag for the month, from the forever
  // log_daily_sessions rows (one per (day, session)). The per-day frequency
  // classifier keys by day+UA, so passing the raw day-rows matches the daily rollup.
  const session_days = shared_db.prepare(`
    SELECT day, session_id, user_agent, heartbeats, has_user_id, webdriver
    FROM log_daily_sessions WHERE substr(day, 1, 7) = ?
  `).all(month) as { day: string, session_id: string, user_agent: string | null, heartbeats: number, has_user_id: number, webdriver: number | null }[]
  const freq_bots = classify_ua_frequency_bot_sessions({
    sessions: session_days.map(row => ({ session_id: row.session_id, day: row.day, user_agent: row.user_agent, heartbeats: row.heartbeats, has_user_id: row.has_user_id === 1 })),
  })
  const bot_sessions = new Set<string>(freq_bots)
  const has_user = new Map<string, boolean>()
  for (const row of session_days) {
    if (is_bot_user_agent(row.user_agent) || row.webdriver === 1)
      bot_sessions.add(row.session_id)
    if (row.has_user_id === 1)
      has_user.set(row.session_id, true)
  }

  const scopes = new Map<string, ScopeAccum>()
  const accum = (scope: string, session_id: string, visitor_id: string | null): void => {
    if (bot_sessions.has(session_id))
      return
    let sc = scopes.get(scope)
    if (!sc) {
      sc = { visits: new Set(), anon_visits: new Set(), visitors: new Set(), anon_visitors: new Set() }
      scopes.set(scope, sc)
    }
    const visitor_key = visitor_id ?? session_id
    const is_anon = !has_user.get(session_id)
    sc.visits.add(session_id)
    sc.visitors.add(visitor_key)
    if (is_anon) {
      sc.anon_visits.add(session_id)
      sc.anon_visitors.add(visitor_key)
    }
  }

  // Scan raw rows from BOTH files (a month spans the 14d hot / 60d archive boundary).
  for (const db of [logs_db, archive_db]) {
    for (const row of db.prepare(`
      SELECT json_extract(context, '$.dictionary_id') dict, session_id, visitor_id
      FROM client_logs
      WHERE received_at >= ? AND received_at < ? AND message = ? AND session_id IS NOT NULL
        AND json_extract(context, '$.dictionary_id') IS NOT NULL
    `).all(month_start_iso, month_end_iso, DICTIONARY_OPENED) as { dict: string, session_id: string, visitor_id: string | null }[])
      accum(row.dict, row.session_id, row.visitor_id)
    for (const row of db.prepare(`
      SELECT session_id, visitor_id FROM client_logs
      WHERE received_at >= ? AND received_at < ? AND message = ? AND session_id IS NOT NULL
    `).all(month_start_iso, month_end_iso, SESSION_START) as { session_id: string, visitor_id: string | null }[])
      accum(SITE_SCOPE, row.session_id, row.visitor_id)
  }

  const insert = shared_db.prepare(`
    INSERT INTO dictionary_monthly_visitors (month, scope, visits, anon_visits, visitors, anon_visitors)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const write = shared_db.transaction(() => {
    shared_db.prepare('DELETE FROM dictionary_monthly_visitors WHERE month = ?').run(month)
    for (const [scope, sc] of scopes)
      insert.run(month, scope, sc.visits.size, sc.anon_visits.size, sc.visitors.size, sc.anon_visitors.size)
  })
  write()
  return { scopes_written: scopes.size }
}

/**
 * Recompute every non-finalized recent month (from the `monthly_visitors_finalized_through`
 * watermark — or the earliest month with raw rows — through the current month) into
 * `dictionary_monthly_visitors`, then advance the watermark to the month BEFORE the
 * current one so completed months FREEZE (their true-unique count is captured while
 * the raw rows still exist, then never recomputed → survives the 60d prune forever).
 * A calendar month is ≤~31 days old when it finalizes (cron runs every 6h), well
 * within the 60d raw window, so full coverage is guaranteed.
 */
export function rollup_recent_months({ shared_db = get_shared_db(), logs_db = get_logs_db(), archive_db = get_log_archive_db(), now = new Date() }: {
  shared_db?: Database.Database
  logs_db?: Database.Database
  archive_db?: Database.Database
  now?: Date
} = {}): { months_rolled: number } {
  const current = month_string(now)
  const finalized = (shared_db.prepare(`SELECT value FROM db_metadata WHERE key = ?`).get(MONTHLY_FINALIZED_KEY) as { value: string } | undefined)?.value ?? null
  const earliest_raw = [logs_db, archive_db]
    .map(db => (db.prepare(`SELECT substr(MIN(received_at), 1, 7) m FROM client_logs`).get() as { m: string | null }).m)
    .filter((month): month is string => !!month)
    .sort()[0] ?? current
  let start = finalized ? next_month(finalized) : earliest_raw
  if (start > current)
    start = current

  let months_rolled = 0
  for (let month = start; month <= current; month = next_month(month)) {
    rollup_month({ month, shared_db, logs_db, archive_db })
    months_rolled++
  }

  const prev = prev_month(current)
  if (start <= prev && (!finalized || prev > finalized)) {
    shared_db.prepare(`
      INSERT INTO db_metadata (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(MONTHLY_FINALIZED_KEY, prev)
  }
  return { months_rolled }
}

/**
 * Move `client_logs` rows older than HOT_WINDOW_DAYS from `logs.db` into the
 * archive file, then prune archive rows older than ARCHIVE_WINDOW_DAYS. The
 * insert is `INSERT OR IGNORE` on the id PK so a crash between insert + delete
 * is safe to retry. Returns counts for observability.
 */
export function archive_old_logs({ logs_db = get_logs_db(), archive_db = get_log_archive_db(), now = new Date() }: {
  logs_db?: Database.Database
  archive_db?: Database.Database
  now?: Date
} = {}): { archived: number, pruned: number } {
  const hot_cutoff = new Date(now.getTime() - HOT_WINDOW_DAYS * DAY_MS).toISOString()
  const archive_cutoff = new Date(now.getTime() - ARCHIVE_WINDOW_DAYS * DAY_MS).toISOString()

  const columns = CLIENT_LOG_COLUMNS.join(', ')
  const placeholders = CLIENT_LOG_COLUMNS.map(() => '?').join(', ')
  const old_rows = logs_db.prepare(`SELECT ${columns} FROM client_logs WHERE received_at < ?`).all(hot_cutoff) as Record<string, unknown>[]

  if (old_rows.length) {
    const insert = archive_db.prepare(`INSERT OR IGNORE INTO client_logs (${columns}) VALUES (${placeholders})`)
    const insert_all = archive_db.transaction((rows: Record<string, unknown>[]) => {
      for (const row of rows)
        insert.run(...CLIENT_LOG_COLUMNS.map(column => row[column] ?? null))
    })
    insert_all(old_rows)
    logs_db.prepare('DELETE FROM client_logs WHERE received_at < ?').run(hot_cutoff)
  }

  const pruned = archive_db.prepare('DELETE FROM client_logs WHERE received_at < ?').run(archive_cutoff).changes
  return { archived: old_rows.length, pruned }
}

const VACUUM_MIN_RECLAIMABLE_BYTES = 64 * 1024 * 1024
const VACUUM_MIN_RECLAIMABLE_FRACTION = 0.25

/**
 * VACUUM a log db after the prune, but only when it's worth the cost. VACUUM
 * rewrites the whole file synchronously (blocks the event loop for seconds on a
 * multi-hundred-MB db), so it only fires when the freelist holds meaningful
 * reclaimable space: ≥64 MB outright, or ≥25% of the file (and ≥8 MB, so a tiny
 * dev db never bothers). Without this, a growth bulge (e.g. the 2026-07 SEO
 * crawl, +111 MB/6h) keeps logs.db at its peak size forever once the bulge ages
 * out of the hot window — freed pages get reused but the disk is never returned.
 */
export function vacuum_if_worthwhile({ db, label, min_reclaimable_bytes = VACUUM_MIN_RECLAIMABLE_BYTES, min_reclaimable_fraction = VACUUM_MIN_RECLAIMABLE_FRACTION }: {
  db: Database.Database
  label: string
  min_reclaimable_bytes?: number
  min_reclaimable_fraction?: number
}): { vacuumed: boolean, reclaimable_bytes: number } {
  const page_size = db.pragma('page_size', { simple: true }) as number
  const freelist_pages = db.pragma('freelist_count', { simple: true }) as number
  const page_count = db.pragma('page_count', { simple: true }) as number
  const reclaimable_bytes = freelist_pages * page_size
  const reclaimable_fraction = page_count ? freelist_pages / page_count : 0
  const worthwhile = reclaimable_bytes >= min_reclaimable_bytes
    || (reclaimable_fraction >= min_reclaimable_fraction && reclaimable_bytes >= 8 * 1024 * 1024)
  if (!worthwhile)
    return { vacuumed: false, reclaimable_bytes }
  db.exec('VACUUM')
  console.info(`[log-retention] VACUUM ${label}: reclaimed ~${Math.round(reclaimable_bytes / 1024 / 1024)} MB.`)
  return { vacuumed: true, reclaimable_bytes }
}

/** db_metadata key: the last COMPLETED day whose rollup ran after the day ended. */
export const ROLLUP_WATERMARK_KEY = 'log_rollup_finalized_through'

/** Read the finalization watermark ('YYYY-MM-DD'), or null when never set (dev / pre-cutover). */
export function get_rollup_watermark(shared_db: Database.Database): string | null {
  try {
    return (shared_db.prepare(`SELECT value FROM db_metadata WHERE key = ?`).get(ROLLUP_WATERMARK_KEY) as { value: string } | undefined)?.value ?? null
  } catch {
    return null
  }
}

/**
 * One-time healing pass over ARCHIVED days: re-roll each fully-archived day from
 * its archive rows under the CURRENT rules. This purges ghost metrics (rollup_day
 * was upsert-without-delete before 2026-07-05) and seeds the new `real_errors`
 * metric + `log_daily_sessions` materialization for days whose raw rows already
 * left hot storage. Days still (partially) hot are the sweep's own job. Flagged
 * in db_metadata so it never re-runs.
 */
export function reroll_archived_days_once({ shared_db = get_shared_db(), logs_db = get_logs_db(), archive_db = get_log_archive_db() }: {
  shared_db?: Database.Database
  logs_db?: Database.Database
  archive_db?: Database.Database
} = {}): { days_rerolled: number } {
  const already = (shared_db.prepare(`SELECT value FROM db_metadata WHERE key = 'archived_days_rerolled'`).get() as { value: string } | undefined)?.value
  if (already)
    return { days_rerolled: 0 }
  const hot_min_day = (logs_db.prepare(`SELECT substr(MIN(received_at), 1, 10) day FROM client_logs`).get() as { day: string | null }).day ?? '9999-12-31'
  const archived_days = (archive_db.prepare(`SELECT DISTINCT substr(received_at, 1, 10) day FROM client_logs ORDER BY day`).all() as { day: string }[])
    .map(row => row.day)
    .filter(day => day < hot_min_day) // a boundary day split across files stays owned by its hot-time rollup
  for (const day of archived_days)
    rollup_day({ day, shared_db, logs_db: archive_db })
  shared_db.prepare(`
    INSERT INTO db_metadata (key, value) VALUES ('archived_days_rerolled', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(new Date().toISOString())
  return { days_rerolled: archived_days.length }
}

/**
 * One retention pass: roll up days past the finalization watermark (usually just
 * today), advance the watermark to the last completed day, then archive + prune.
 * To force a re-roll of finalized days (e.g. after changing rollup rules while
 * their raw rows are still hot/archived), delete the watermark row and re-run.
 *
 * Every sub-step runs through `step()` so a throw in one (e.g. the one-time
 * archive heal, or a single malformed day's rollup) is logged (console + a
 * `log_retention_step_failed` server event tagged with the step name) and
 * swallowed — the rest of the sweep still runs. Hardening ported from house
 * (2026-07-05) after a bug in the unconditional, runs-first
 * `reroll_archived_days_once` heal aborted the ENTIRE sweep (no rollup, no
 * archive, no prune) every single pass. One brittle sub-step must never take
 * down the ordinary rollup/archive/prune.
 */
export function run_log_retention_once({ shared_db = get_shared_db(), logs_db = get_logs_db(), archive_db = get_log_archive_db(), now = new Date() }: {
  shared_db?: Database.Database
  logs_db?: Database.Database
  archive_db?: Database.Database
  now?: Date
} = {}): { days_rolled: number, archived: number, pruned: number } {
  const step = <T>({ label, fallback, run }: { label: string, fallback: T, run: () => T }): T => {
    try {
      return run()
    } catch (err) {
      console.error(`[log-retention] step '${label}' failed (continuing sweep):`, err)
      log_server_event({ level: 'error', message: 'log_retention_step_failed', error: err, context: { step: label }, db: logs_db })
      return fallback
    }
  }

  step({ label: 'reroll_archived_days_once', fallback: undefined, run: () => reroll_archived_days_once({ shared_db, logs_db, archive_db }) })
  const watermark = get_rollup_watermark(shared_db)
  const days = step({
    label: 'list_hot_days',
    fallback: [] as string[],
    run: () => (logs_db.prepare('SELECT DISTINCT substr(received_at, 1, 10) day FROM client_logs ORDER BY day').all() as { day: string }[])
      .map(row => row.day)
      .filter(day => !watermark || day > watermark),
  })
  let days_rolled = 0
  for (const day of days) {
    step({ label: `rollup_day:${day}`, fallback: undefined, run: () => {
      rollup_day({ day, shared_db, logs_db })
      days_rolled++
    } })
  }
  // Every day ≤ yesterday is now final: its rows are immutable and were just
  // rolled if any existed (quiet days have nothing to roll) — so the watermark
  // advances to yesterday even when a day had zero rows.
  const yesterday = new Date(now.getTime() - DAY_MS).toISOString().slice(0, 10)
  if (yesterday && (!watermark || yesterday > watermark)) {
    step({ label: 'advance_watermark', fallback: undefined, run: () => {
      shared_db.prepare(`
        INSERT INTO db_metadata (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(ROLLUP_WATERMARK_KEY, yesterday)
    } })
  }
  // TRUE unique-visitor monthly rollup — BEFORE archive/prune so the current +
  // recently-completed months' raw rows are all still present (hot or archive) for
  // the union. Reads both files, so archive order doesn't matter for correctness.
  step({ label: 'rollup_recent_months', fallback: undefined, run: () => rollup_recent_months({ shared_db, logs_db, archive_db, now }) })
  const { archived, pruned } = step({
    label: 'archive_old_logs',
    fallback: { archived: 0, pruned: 0 },
    run: () => archive_old_logs({ logs_db, archive_db, now }),
  })
  // Return pruned disk to the OS once a growth bulge drains (guarded — see helper).
  step({ label: 'vacuum_logs_db', fallback: undefined, run: () => vacuum_if_worthwhile({ db: logs_db, label: 'logs.db' }) })
  step({ label: 'vacuum_archive_db', fallback: undefined, run: () => vacuum_if_worthwhile({ db: archive_db, label: 'logs-archive.db' }) })
  step({ label: 'record_ran_at', fallback: undefined, run: () => {
    shared_db.prepare(`
      INSERT INTO db_metadata (key, value) VALUES ('log_retention_ran_at', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(now.toISOString())
  } })
  return { days_rolled, archived, pruned }
}

const SINGLETON_KEY = Symbol.for('living.log-retention-cron.state')
interface CronState { interval: ReturnType<typeof setInterval>, in_flight: boolean }
interface GlobalWithCron { [SINGLETON_KEY]?: CronState }

export function start_log_retention_cron_once(): void {
  // No env flag — log retention always runs on the active node so trends never
  // silently stop accumulating. Two hardcoded guards only:
  //   - dev/build: dormant locally (matches the other crons; unit tests cover it).
  //   - IS_STANDBY: standby containers must never run singleton jobs — the active
  //     container (no IS_STANDBY) is the sole cron node.
  if (building || dev)
    return
  if (env.IS_STANDBY === 'true') {
    console.info('[log-retention] IS_STANDBY — cron disabled on standby container.')
    return
  }
  const slot = globalThis as unknown as GlobalWithCron
  if (slot[SINGLETON_KEY]) {
    console.info('[log-retention] Already running — skip.')
    return
  }
  const state: CronState = {
    // .unref(): a background maintenance timer must never be the sole reason the
    // Node process stays alive. No-op in prod (the HTTP server holds Node open),
    // but lets one-shot in-process importers exit cleanly instead of hanging.
    interval: setInterval(() => run_guarded(state), RETENTION_INTERVAL_MS).unref(),
    in_flight: false,
  }
  slot[SINGLETON_KEY] = state
  run_guarded(state) // first sweep on boot
  console.info(`[log-retention] Started — sweeping every ${RETENTION_INTERVAL_MS / 3_600_000}h (hot ${HOT_WINDOW_DAYS}d, archive ${ARCHIVE_WINDOW_DAYS}d).`)
}

export function stop_log_retention_cron(): void {
  const slot = globalThis as unknown as GlobalWithCron
  const state = slot[SINGLETON_KEY]
  if (!state)
    return
  clearInterval(state.interval)
  delete slot[SINGLETON_KEY]
}

function run_guarded(state: CronState): void {
  if (state.in_flight)
    return
  state.in_flight = true
  try {
    const result = run_log_retention_once()
    console.info(`[log-retention] rolled ${result.days_rolled} day(s), archived ${result.archived}, pruned ${result.pruned}.`)
  } catch (err) {
    console.error('[log-retention] sweep failed:', err)
    log_server_event({ level: 'error', message: 'log_retention_sweep_failed', error: err })
  } finally {
    state.in_flight = false
  }
}
