import type Database from 'better-sqlite3'
import { building, dev } from '$app/environment'
import { env } from '$env/dynamic/private'
import { is_bot_user_agent } from '$lib/debug/parse-user-agent'
import { geo_key } from '$lib/server/geo-from-request'
import { log_server_event } from '$lib/server/log-server-event'
import { CLIENT_LOG_COLUMNS, get_log_archive_db } from './log-archive-db'
import { get_shared_db } from './shared-db'

/**
 * Two-tier log retention + a forever daily rollup.
 *
 *   - rollup_day()      aggregates a day's `client_logs` into `log_daily_metrics`
 *                       (idempotent overwrite) so trends outlive the raw rows.
 *   - archive_old_logs() moves rows older than HOT_WINDOW_DAYS from `shared.db`
 *                       into `logs-archive.db`, then prunes the archive past
 *                       ARCHIVE_WINDOW_DAYS.
 *
 * The cron rolls up EVERY distinct day still present in hot storage on each run
 * (cheap — ≤ ~14 days, idempotent) BEFORE archival, so no day is lost even if a
 * run is missed. Singleton-guarded; always runs on the active node (only
 * IS_STANDBY + dev/build gated — no enable flag).
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
  // Otherwise a per-dictionary route: /[dictionaryId]/(entries/[entryId]|settings|about|…)
  const [, sub] = segments
  if (!sub)
    return 'dictionary:entries'
  if (sub === 'entries')
    return 'dictionary:entry'
  return `dictionary:${sub}`
}

interface AccumRow { source: string, level: string, message: string, user_id: string | null, context: string | null, country: string | null, region: string | null, user_agent: string | null }

/**
 * Aggregate one UTC day's `client_logs` into `log_daily_metrics`. Idempotent:
 * existing rows for the day are overwritten, so re-running (e.g. for "today",
 * still accumulating) is safe.
 */
export function rollup_day({ day, shared_db = get_shared_db() }: { day: string, shared_db?: Database.Database }): { metrics_written: number } {
  const rows = shared_db.prepare(`
    SELECT coalesce(source,'client') source, level, message, user_id, context, country, region, user_agent
    FROM client_logs WHERE substr(received_at, 1, 10) = ?
  `).all(day) as AccumRow[]

  interface Bucket {
    sessions: Set<string>
    users: Set<string>
    logs: number
    errors: number
    levels: Map<string, number>
    events: Map<string, number>
    navs: Map<string, number>
    /** Distinct sessions per area key (`US-CA` / `US`). Forever "which areas have users". */
    geo: Map<string, Set<string>>
  }
  const make_bucket = (): Bucket => ({ sessions: new Set(), users: new Set(), logs: 0, errors: 0, levels: new Map(), events: new Map(), navs: new Map(), geo: new Map() })
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

  for (const row of rows) {
    const bucket = is_bot_user_agent(row.user_agent) ? bot_bucket : bucket_for(row.source)
    bucket.logs++
    if (ERROR_LEVELS.has(row.level))
      bucket.errors++
    bump(bucket.levels, row.level)
    if (row.user_id)
      bucket.users.add(row.user_id)
    let context: Record<string, unknown> | null
    try { context = row.context ? JSON.parse(row.context) as Record<string, unknown> : null } catch { context = null }
    const session_id = context?.session_id
    if (typeof session_id === 'string' && session_id) {
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
  // `prefix` is '' for human/server buckets, 'bot:' for the bot bucket.
  const emit = (bucket: Bucket, source: string, prefix: string): void => {
    metrics.push({ metric: `${prefix}sessions`, source, value: bucket.sessions.size })
    metrics.push({ metric: `${prefix}users`, source, value: bucket.users.size })
    metrics.push({ metric: `${prefix}logs`, source, value: bucket.logs })
    metrics.push({ metric: `${prefix}errors`, source, value: bucket.errors })
    for (const [level, value] of bucket.levels)
      metrics.push({ metric: `${prefix}level:${level}`, source, value })
    for (const [event, value] of bucket.events)
      metrics.push({ metric: `${prefix}event:${event}`, source, value })
    for (const [route, value] of bucket.navs)
      metrics.push({ metric: `${prefix}nav:${route}`, source, value })
    for (const [area, sessions] of bucket.geo)
      metrics.push({ metric: `${prefix}geo:${area}`, source, value: sessions.size })
  }
  for (const [source, bucket] of by_source)
    emit(bucket, source, '')
  if (bot_bucket.logs > 0)
    emit(bot_bucket, 'client', 'bot:')

  const upsert = shared_db.prepare(`
    INSERT INTO log_daily_metrics (day, metric, source, value) VALUES (?, ?, ?, ?)
    ON CONFLICT(day, metric, source) DO UPDATE SET value = excluded.value
  `)
  const write_all = shared_db.transaction((items: typeof metrics) => {
    for (const item of items)
      upsert.run(day, item.metric, item.source, item.value)
  })
  write_all(metrics)
  return { metrics_written: metrics.length }
}

/**
 * Move `client_logs` rows older than HOT_WINDOW_DAYS from `shared.db` into the
 * archive file, then prune archive rows older than ARCHIVE_WINDOW_DAYS. The
 * insert is `INSERT OR IGNORE` on the id PK so a crash between insert + delete
 * is safe to retry. Returns counts for observability.
 */
export function archive_old_logs({ shared_db = get_shared_db(), archive_db = get_log_archive_db(), now = new Date() }: {
  shared_db?: Database.Database
  archive_db?: Database.Database
  now?: Date
} = {}): { archived: number, pruned: number } {
  const hot_cutoff = new Date(now.getTime() - HOT_WINDOW_DAYS * DAY_MS).toISOString()
  const archive_cutoff = new Date(now.getTime() - ARCHIVE_WINDOW_DAYS * DAY_MS).toISOString()

  const columns = CLIENT_LOG_COLUMNS.join(', ')
  const placeholders = CLIENT_LOG_COLUMNS.map(() => '?').join(', ')
  const old_rows = shared_db.prepare(`SELECT ${columns} FROM client_logs WHERE received_at < ?`).all(hot_cutoff) as Record<string, unknown>[]

  if (old_rows.length) {
    const insert = archive_db.prepare(`INSERT OR IGNORE INTO client_logs (${columns}) VALUES (${placeholders})`)
    const insert_all = archive_db.transaction((rows: Record<string, unknown>[]) => {
      for (const row of rows)
        insert.run(...CLIENT_LOG_COLUMNS.map(column => row[column] ?? null))
    })
    insert_all(old_rows)
    shared_db.prepare('DELETE FROM client_logs WHERE received_at < ?').run(hot_cutoff)
  }

  const pruned = archive_db.prepare('DELETE FROM client_logs WHERE received_at < ?').run(archive_cutoff).changes
  return { archived: old_rows.length, pruned }
}

/** One retention pass: roll up every hot day, then archive + prune. */
export function run_log_retention_once({ shared_db = get_shared_db(), archive_db = get_log_archive_db(), now = new Date() }: {
  shared_db?: Database.Database
  archive_db?: Database.Database
  now?: Date
} = {}): { days_rolled: number, archived: number, pruned: number } {
  const days = (shared_db.prepare('SELECT DISTINCT substr(received_at, 1, 10) day FROM client_logs').all() as { day: string }[]).map(row => row.day)
  for (const day of days)
    rollup_day({ day, shared_db })
  const { archived, pruned } = archive_old_logs({ shared_db, archive_db, now })
  shared_db.prepare(`
    INSERT INTO db_metadata (key, value) VALUES ('log_retention_ran_at', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(now.toISOString())
  return { days_rolled: days.length, archived, pruned }
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
    interval: setInterval(() => run_guarded(state), RETENTION_INTERVAL_MS),
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
