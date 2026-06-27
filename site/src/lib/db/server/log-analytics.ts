import type Database from 'better-sqlite3'
import { version } from '$app/environment'
import { ALL_TRACKED_EVENTS } from '$lib/debug/log-events'
import { is_below_db_worker_capability, is_bot_user_agent, parse_user_agent } from '$lib/debug/parse-user-agent'
import { distance_bucket, DISTANCE_BUCKETS, distance_to_origin_km } from '$lib/geo/distance'
import { geo_key } from '$lib/server/geo-from-request'
import { get_log_archive_db } from './log-archive-db'
import { normalize_route } from './log-retention-cron'
import { get_shared_db } from './shared-db'

/**
 * Live, server-side analytics for `/admin/analytics`. Reads `client_logs`
 * (hot window) AND the forever `log_daily_metrics` rollup, merging them PER DAY
 * with live taking precedence — so a day still in hot storage is always fresh,
 * an archived day falls back to its rollup, and dev (where the cron never runs,
 * so nothing is archived) shows everything live. NOT synced local-first; this is
 * operator data queried from the server like the rest of the admin DB ops.
 */

const ERROR_LEVELS_SQL = `('error','unhandled_rejection','crash')`
/** Infra/telemetry plumbing excluded from the "top events" list so real analytics events surface. */
const INFRA_EVENTS = new Set(['heartbeat', 'navigation', 'perf', 'session_start', 'visibility_visible', 'visibility_hidden', 'uptime_probe'])
const TOP_LIMIT = 12
const ERROR_CLUSTER_LIMIT = 25

/**
 * Known-benign error classes folded out of the real-error headline. Seed: the
 * `/api/log` flush endpoint failing on sleep/redeploy and self-logging.
 */
const KNOWN_NOISE_PATTERNS = ['Network error for /api/log', 'Failed to fetch dynamically imported module']
function is_known_noise(message: string): boolean {
  return KNOWN_NOISE_PATTERNS.some(pattern => message.includes(pattern))
}

/**
 * The global Humans/Bots toggle. Usage/engagement/geo/perf panels re-filter by
 * this; diagnostics (error_clusters / errors_by_version / leader_health) always
 * show ALL rows — a bot hitting a real error is still a real signal. We want to be
 * AI-agent- + SEO-friendly, so bot traffic is viewable, not just excluded.
 *
 * Humans = server rows (NULL UA) + non-bot UAs; Bots = client rows whose UA
 * matches the crawler/headless regex. The cold rollup is read from the matching
 * metric namespace (`''` for humans, `'bot:'` for bots).
 */
export type Audience = 'humans' | 'bots'

/** Register `is_bot_ua(user_agent)` once per connection (better-sqlite3 throws on a duplicate name). */
const is_bot_ua_registered = new WeakSet<Database.Database>()
function ensure_is_bot_ua(db: Database.Database): void {
  if (is_bot_ua_registered.has(db))
    return
  db.function('is_bot_ua', { deterministic: true }, (ua: unknown) => (is_bot_user_agent(typeof ua === 'string' ? ua : null) ? 1 : 0))
  is_bot_ua_registered.add(db)
}

/** Timing metrics surfaced on the performance panel, in display order. */
const PERF_METRICS = ['page_load', 'search'] as const
/** Core Web Vitals surfaced on the dashboard, in display order (the canonical CWV trio first). */
const WEB_VITAL_METRICS = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'] as const

export interface DailyPoint { day: string, sessions: number, users: number, errors: number, logs: number }
export interface PerfSummary { name: string, count: number, p50: number | null, p90: number | null, p95: number | null, max: number | null }
export interface PerfDailyPoint { day: string, metrics: Record<string, { p50: number, p95: number, count: number }> }
/** Core Web Vitals distribution (LCP/INP/CLS/FCP/TTFB); `value` is ms except CLS (unitless). p75 is the CWV threshold metric. */
export interface WebVitalSummary { metric: string, count: number, p50: number | null, p75: number | null, p95: number | null }
/** Per-bucket TTFB (page_load `responseStart`) distribution. */
export interface GeoLatency { label: string, count: number, p50: number | null, p95: number | null }
export interface GeoAnalytics {
  /** Sessions with a known location (hot + cold merged). */
  located_sessions: number
  /** Top areas (`US-CA` / `US`) by sessions — forever-rollup-backed for cold days. */
  areas: { key: string, country: string, sessions: number }[]
  /** Real-user TTFB split by country (hot window — page_load `responseStart`). */
  ttfb_by_country: GeoLatency[]
  /** Real-user TTFB split by distance to the Boston origin (hot window). */
  ttfb_by_distance: GeoLatency[]
}
/** Errors split by build version so deploy-tail noise on stale tabs is legible vs real errors. */
export interface ErrorsByVersion {
  /** The live deployed build id (`$app/environment` version); null if unknown. */
  current_version: string | null
  /** Total errors in the hot window (the split denominator — app_version isn't in the rollup). */
  total: number
  /** Errors emitted by the current build. */
  current: number
  /** Errors emitted by any non-current (stale) build. */
  stale: number
  /** stale ÷ total; null when there are no hot-window errors. */
  stale_pct: number | null
  /** Per-version error counts, highest first. */
  versions: { version: string | null, errors: number, is_current: boolean }[]
}
/**
 * Ingestion liveness — answers "is the pipeline broken, or just no traffic?" at a
 * glance. The 2026-06-25 review burned 20 minutes resolving exactly this ambiguity.
 */
export interface PipelineHealth {
  /** Newest `received_at` across ALL hot rows (any level/source); null if empty. */
  last_log_at: string | null
  /** Newest `session_start` row — proof a real browser session shipped logs. */
  last_session_start_at: string | null
  /** Newest server-sourced row — proof server-side logging is wired + flowing. */
  last_server_log_at: string | null
  /** `db_metadata.log_retention_ran_at` — the retention cron's last run. */
  retention_ran_at: string | null
  /** Total hot rows in `shared.db.client_logs` right now. */
  hot_rows: number
  /** Total cold rows archived in `logs-archive.db`. */
  archived_rows: number
}
/** Self-instrumentation: which declared analytics events have actually been seen. */
export interface EventCoverage {
  /** Event name + whether it's been seen in the window + lifetime count. */
  events: { event: string, seen: boolean, count: number }[]
  /** Count of declared events never seen in the window — the blind spots. */
  never_emitted: number
}
/**
 * Leader-worker DB health — the dominant REAL client error class (shared OPFS
 * leader-worker harness). Healthy = timeouts paired with recoveries, ~0 failed.
 */
export interface LeaderHealth {
  timeouts: number
  recovered: number
  /** Retries exhausted — the panel genuinely couldn't load. The real signal. */
  failed: number
  /** `had_leader:false` failures — a boot/election fault (wedged leader). */
  failed_no_leader: number
  /** Per-source (admin/viewer/dict) failed counts. */
  failed_by_source: { source: string, count: number }[]
}
/** A grouped error class (message + stack head), with span + reach + a known-noise flag. */
export interface ErrorCluster {
  message: string
  stack_head: string
  level: string
  count: number
  users: number
  first_seen: string
  last_seen: string
  /** Distinct sources seen for this cluster, e.g. `client` / `server` / `client,server`. */
  sources: string
  /** Distinct platforms, e.g. `web` / `android` / `web,ios`. */
  platforms: string
  /** True when the message matches a `KNOWN_NOISE_PATTERNS` entry (excluded from the real-error count). */
  is_noise: boolean
}
export interface LogAnalytics {
  /** Which audience these usage/geo/perf panels were computed for. */
  audience: Audience
  window_days: number
  generated_at: string
  daily: DailyPoint[]
  totals: { sessions: number, errors: number, logs: number, unique_users: number }
  top_routes: { route: string, count: number }[]
  top_events: { event: string, count: number }[]
  by_source: { source: string, logs: number, errors: number }[]
  /** Grouped error classes (message + stack head), real errors first, known-noise sunk. Always ALL rows. */
  error_clusters: ErrorCluster[]
  /** Per-session browser breakdown (hot window only — UA isn't in the rollup). */
  browsers: { label: string, os: string, sessions: number, below_capability: boolean }[]
  /** Local-DB capability: how many (human) sessions can't run the leader-worker DB. */
  capability: { total_sessions: number, below_capability_sessions: number, bot_sessions: number, db_tiers: { tier: string, sessions: number }[] }
  /** Client `perf` timings (hot window only — percentiles aren't in the rollup). */
  performance: { summary: PerfSummary[], daily: PerfDailyPoint[] }
  /** Core Web Vitals distribution (hot window, human sessions only). Empty array when none landed yet. */
  web_vitals: WebVitalSummary[]
  /** Approximate geography from CF edge headers — areas + geo-split TTFB. */
  geo: GeoAnalytics
  /** Errors split by current vs stale build version (hot window only). */
  errors_by_version: ErrorsByVersion
  /** Ingestion liveness — broken vs no-traffic at a glance. */
  pipeline: PipelineHealth
  /** Declared analytics events vs what's actually been seen. */
  event_coverage: EventCoverage
  /** Leader-worker DB health (live_query_* family). */
  leader_health: LeaderHealth
}

/** Nearest-rank percentile of an UNSORTED numeric array; null when empty. */
function percentile(values: number[], pct: number): number | null {
  if (!values.length)
    return null
  const sorted = [...values].sort((first, second) => first - second)
  const rank = Math.ceil((pct / 100) * sorted.length)
  return sorted[Math.min(Math.max(rank, 1), sorted.length) - 1]
}

function day_string(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function bump(map: Map<string, number>, key: string, by = 1): void {
  map.set(key, (map.get(key) ?? 0) + by)
}

export function get_log_analytics({ shared_db = get_shared_db(), days = 30, now = new Date(), current_app_version = version, audience = 'humans' }: {
  shared_db?: Database.Database
  days?: number
  now?: Date
  /** The live deployed build id; errors on any other build count as "stale". */
  current_app_version?: string | null
  /** Humans (default) or Bots — re-filters every usage/engagement/geo/perf panel. */
  audience?: Audience
} = {}): LogAnalytics {
  ensure_is_bot_ua(shared_db)
  const window_start = new Date(now.getTime() - (days - 1) * 86_400_000)
  const window_start_day = day_string(window_start)
  const window_start_iso = `${window_start_day}T00:00:00.000Z`

  // Audience filter for hot rows; the cold rollup is read from the matching
  // metric namespace (`''` for humans, `'bot:'` for bots).
  const audience_filter = audience === 'bots'
    ? `(user_agent IS NOT NULL AND is_bot_ua(user_agent) = 1)`
    : `(user_agent IS NULL OR is_bot_ua(user_agent) = 0)`
  // Map a stored rollup metric → the metric for THIS audience, or null to skip.
  const rollup_metric = (metric: string): string | null => {
    const is_bot_metric = metric.startsWith('bot:')
    if (audience === 'bots')
      return is_bot_metric ? metric.slice(4) : null
    return is_bot_metric ? null : metric
  }

  // --- Live (hot) daily scalars, combined across sources. Bot/headless rows
  // excluded so the sessions/users/logs/errors trend reflects real people. ---
  const live_daily = shared_db.prepare(`
    SELECT substr(received_at, 1, 10) day,
           COUNT(*) logs,
           SUM(CASE WHEN level IN ${ERROR_LEVELS_SQL} THEN 1 ELSE 0 END) errors,
           COUNT(DISTINCT user_id) users,
           COUNT(DISTINCT json_extract(context, '$.session_id')) sessions
    FROM client_logs WHERE received_at >= ? AND ${audience_filter}
    GROUP BY day
  `).all(window_start_iso) as DailyPoint[]
  const live_by_day = new Map(live_daily.map(point => [point.day, point]))

  // --- Rollup rows for the window (used only for days with NO live rows). ---
  const rollup_rows = shared_db.prepare(`
    SELECT day, metric, source, value FROM log_daily_metrics WHERE day >= ?
  `).all(window_start_day) as { day: string, metric: string, source: string, value: number }[]
  const rollup_by_day = new Map<string, DailyPoint>()
  for (const row of rollup_rows) {
    if (live_by_day.has(row.day))
      continue // live wins for this day
    const metric = rollup_metric(row.metric)
    if (metric === null)
      continue // wrong audience namespace
    let point = rollup_by_day.get(row.day)
    if (!point) {
      point = { day: row.day, sessions: 0, users: 0, errors: 0, logs: 0 }
      rollup_by_day.set(row.day, point)
    }
    if (metric === 'sessions') point.sessions += row.value
    else if (metric === 'users') point.users += row.value
    else if (metric === 'errors') point.errors += row.value
    else if (metric === 'logs') point.logs += row.value
  }

  // --- Merge into a zero-filled ascending daily series. ---
  const daily: DailyPoint[] = []
  for (let offset = days - 1; offset >= 0; offset--) {
    const day = day_string(new Date(now.getTime() - offset * 86_400_000))
    daily.push(live_by_day.get(day) ?? rollup_by_day.get(day) ?? { day, sessions: 0, users: 0, errors: 0, logs: 0 })
  }

  // --- Top events: live (hot) + rollup (cold days only), infra excluded. ---
  const event_counts = new Map<string, number>()
  for (const row of shared_db.prepare(`
    SELECT message event, COUNT(*) count FROM client_logs
    WHERE received_at >= ? AND level = 'info' AND ${audience_filter} GROUP BY message
  `).all(window_start_iso) as { event: string, count: number }[]) {
    if (!INFRA_EVENTS.has(row.event))
      bump(event_counts, row.event, row.count)
  }
  // --- Top routes: live nav (normalized) + rollup nav (cold). ---
  const route_counts = new Map<string, number>()
  for (const row of shared_db.prepare(`
    SELECT json_extract(context, '$.to') to_path, COUNT(*) count FROM client_logs
    WHERE received_at >= ? AND message = 'navigation' AND ${audience_filter} GROUP BY to_path
  `).all(window_start_iso) as { to_path: string | null, count: number }[]) {
    bump(route_counts, normalize_route(row.to_path), row.count)
  }
  // --- Geo areas: per-area (`US-CA` / `US`) distinct HUMAN sessions, hot
  // (session_rows below, bots skipped there) + cold (rollup `geo:` metrics, now
  // bot-free at rollup time). Consistent human-only counts across both tiers. ---
  const area_counts = new Map<string, { country: string, sessions: number }>()
  // --- Source split: live + rollup (cold). Bot client rows excluded; server
  // rows (NULL UA) kept. ---
  const source_logs = new Map<string, number>()
  const source_errors = new Map<string, number>()
  for (const row of shared_db.prepare(`
    SELECT coalesce(source, 'client') source, COUNT(*) logs,
           SUM(CASE WHEN level IN ${ERROR_LEVELS_SQL} THEN 1 ELSE 0 END) errors
    FROM client_logs WHERE received_at >= ? AND ${audience_filter} GROUP BY source
  `).all(window_start_iso) as { source: string, logs: number, errors: number }[]) {
    bump(source_logs, row.source, row.logs)
    bump(source_errors, row.source, row.errors)
  }

  for (const row of rollup_rows) {
    if (live_by_day.has(row.day))
      continue // cold days only
    const metric = rollup_metric(row.metric)
    if (metric === null)
      continue // wrong audience namespace
    if (metric.startsWith('event:')) {
      const event = metric.slice('event:'.length)
      if (!INFRA_EVENTS.has(event))
        bump(event_counts, event, row.value)
    } else if (metric.startsWith('nav:')) {
      bump(route_counts, metric.slice('nav:'.length), row.value)
    } else if (metric.startsWith('geo:')) {
      const key = metric.slice('geo:'.length)
      const area = area_counts.get(key) ?? { country: key.split('-')[0], sessions: 0 }
      area.sessions += row.value
      area_counts.set(key, area)
    } else if (metric === 'logs') {
      bump(source_logs, row.source, row.value)
    } else if (metric === 'errors') {
      bump(source_errors, row.source, row.value)
    }
  }

  const to_sorted = (map: Map<string, number>, key: 'route' | 'event') =>
    [...map.entries()]
      .map(([name, count]) => ({ [key]: name, count }) as { route?: string, event?: string, count: number })
      .sort((a, b) => b.count - a.count)
      .slice(0, TOP_LIMIT)

  const by_source_keys = new Set([...source_logs.keys(), ...source_errors.keys()])
  const by_source = [...by_source_keys].map(source => ({
    source,
    logs: source_logs.get(source) ?? 0,
    errors: source_errors.get(source) ?? 0,
  })).sort((a, b) => b.logs - a.logs)

  // --- Error clusters: group by message + stack head so one user hitting an
  // error 50× is one row. `is_noise` folds known-benign classes out of the
  // real-error headline. Always ALL rows (a bot's real error still matters). ---
  const error_clusters = (shared_db.prepare(`
    SELECT message,
           substr(coalesce(stack, ''), 1, 200) stack_head,
           MAX(level) level,
           COUNT(*) count,
           COUNT(DISTINCT user_id) users,
           MIN(received_at) first_seen,
           MAX(received_at) last_seen,
           group_concat(DISTINCT coalesce(source, 'client')) sources,
           group_concat(DISTINCT coalesce(platform, 'web')) platforms
    FROM client_logs
    WHERE level IN ${ERROR_LEVELS_SQL} AND received_at >= ?
    GROUP BY message, stack_head
    ORDER BY count DESC, last_seen DESC
    LIMIT ${ERROR_CLUSTER_LIMIT}
  `).all(window_start_iso) as Omit<ErrorCluster, 'is_noise'>[])
    .map(row => ({ ...row, is_noise: is_known_noise(row.message) }))
    .sort((first, second) => Number(first.is_noise) - Number(second.is_noise) || second.count - first.count)

  const unique_users = (shared_db.prepare(`
    SELECT COUNT(DISTINCT user_id) count FROM client_logs WHERE received_at >= ? AND user_id IS NOT NULL AND ${audience_filter}
  `).get(window_start_iso) as { count: number }).count

  // --- Browser / capability breakdown, per session (hot window only — neither
  // the raw user_agent nor the session_start db_tier is in the rollup). One row
  // per session: the user_agent + the db_tier we now stamp on session_start. ---
  const session_rows = shared_db.prepare(`
    SELECT json_extract(context, '$.session_id') sid,
           MAX(user_agent) user_agent,
           MAX(json_extract(context, '$.db_tier')) db_tier,
           MAX(country) country,
           MAX(region) region
    FROM client_logs
    WHERE received_at >= ? AND json_extract(context, '$.session_id') IS NOT NULL
    GROUP BY sid
  `).all(window_start_iso) as { sid: string, user_agent: string | null, db_tier: string | null, country: string | null, region: string | null }[]

  const browser_counts = new Map<string, { sessions: number, below: boolean, os: string }>()
  const tier_counts = new Map<string, number>()
  let below_capability_sessions = 0
  let bot_sessions = 0
  for (const row of session_rows) {
    const is_bot = is_bot_user_agent(row.user_agent)
    // Geo areas follow the active audience (humans by default, bots when toggled)
    // — bot check FIRST so bot sessions don't leak into the human area tally.
    if ((audience === 'bots') === is_bot) {
      const area_key = geo_key({ country: row.country, region: row.region })
      if (area_key && row.country) {
        const area = area_counts.get(area_key) ?? { country: row.country, sessions: 0 }
        area.sessions++
        area_counts.set(area_key, area)
      }
    }
    // Bots (Applebot/Googlebot/GPTBot/headless e2e/…) have no OPFS, never convert,
    // and skew the human browser mix — count them separately but keep them OUT of
    // the breakdown. The browser/capability panel stays human-only regardless of
    // the audience toggle.
    if (is_bot) {
      bot_sessions++
      continue
    }
    const parsed = parse_user_agent(row.user_agent)
    const below = is_below_db_worker_capability(parsed)
    if (below)
      below_capability_sessions++
    const label = parsed.major !== null ? `${parsed.browser} ${parsed.major}` : parsed.browser
    const entry = browser_counts.get(label) ?? { sessions: 0, below, os: parsed.os }
    entry.sessions++
    browser_counts.set(label, entry)
    // Prefer the logged db_tier (new sessions); else infer from UA capability.
    bump(tier_counts, row.db_tier ?? (below ? 'idb-main/floor (inferred)' : 'unknown (legacy)'))
  }
  const browsers = [...browser_counts.entries()]
    .map(([label, value]) => ({ label, os: value.os, sessions: value.sessions, below_capability: value.below }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, TOP_LIMIT)
  const db_tiers = [...tier_counts.entries()]
    .map(([tier, sessions]) => ({ tier, sessions }))
    .sort((a, b) => b.sessions - a.sessions)

  // --- Performance: client `perf` timings, hot window only (the rollup keeps
  // event counts, not duration distributions). `web_vital` rows carry `value`
  // not `duration_ms`, so the NOT NULL filter drops them from the timing mix. ---
  const perf_rows = shared_db.prepare(`
    SELECT substr(received_at, 1, 10) day,
           json_extract(context, '$.name') name,
           json_extract(context, '$.duration_ms') duration_ms
    FROM client_logs
    WHERE received_at >= ? AND message = 'perf' AND ${audience_filter}
      AND json_extract(context, '$.duration_ms') IS NOT NULL
  `).all(window_start_iso) as { day: string, name: string | null, duration_ms: number }[]

  const perf_all = new Map<string, number[]>()
  const perf_by_day = new Map<string, Map<string, number[]>>()
  for (const row of perf_rows) {
    if (!row.name)
      continue
    if (!perf_all.has(row.name))
      perf_all.set(row.name, [])
    perf_all.get(row.name)?.push(row.duration_ms)
    let day_map = perf_by_day.get(row.day)
    if (!day_map) {
      day_map = new Map()
      perf_by_day.set(row.day, day_map)
    }
    if (!day_map.has(row.name))
      day_map.set(row.name, [])
    day_map.get(row.name)?.push(row.duration_ms)
  }

  // Stable display order: known metrics first, then any extras seen.
  const perf_names = [...PERF_METRICS, ...[...perf_all.keys()].filter(name => !PERF_METRICS.includes(name as typeof PERF_METRICS[number]))]
  const perf_summary: PerfSummary[] = perf_names.map((name) => {
    const values = perf_all.get(name) ?? []
    return { name, count: values.length, p50: percentile(values, 50), p90: percentile(values, 90), p95: percentile(values, 95), max: values.length ? Math.max(...values) : null }
  })
  const perf_daily: PerfDailyPoint[] = daily.map((point) => {
    const day_map = perf_by_day.get(point.day)
    const metrics: PerfDailyPoint['metrics'] = {}
    if (day_map) {
      for (const [name, values] of day_map) {
        metrics[name] = { p50: percentile(values, 50) ?? 0, p95: percentile(values, 95) ?? 0, count: values.length }
      }
    }
    return { day: point.day, metrics }
  })

  // --- Core Web Vitals (hot window, human sessions). `web_vital` perf rows carry
  // `value` (ms, or unitless for CLS) not `duration_ms`, so they're aggregated
  // separately from the timing mix above. p75 is the canonical CWV threshold. ---
  const web_vital_rows = shared_db.prepare(`
    SELECT json_extract(context, '$.metric') metric, json_extract(context, '$.value') value
    FROM client_logs
    WHERE received_at >= ? AND message = 'perf' AND ${audience_filter}
      AND json_extract(context, '$.name') = 'web_vital'
      AND json_extract(context, '$.value') IS NOT NULL
  `).all(window_start_iso) as { metric: string | null, value: number }[]
  const web_vital_values = new Map<string, number[]>()
  for (const row of web_vital_rows) {
    if (!row.metric || typeof row.value !== 'number')
      continue
    if (!web_vital_values.has(row.metric))
      web_vital_values.set(row.metric, [])
    web_vital_values.get(row.metric)?.push(row.value)
  }
  // Known CWV first (stable order), then any extras seen.
  const web_vital_names = [...WEB_VITAL_METRICS, ...[...web_vital_values.keys()].filter(name => !WEB_VITAL_METRICS.includes(name as typeof WEB_VITAL_METRICS[number]))]
  const web_vitals: WebVitalSummary[] = web_vital_names
    .filter(name => web_vital_values.has(name))
    .map((name) => {
      const values = web_vital_values.get(name) ?? []
      return { metric: name, count: values.length, p50: percentile(values, 50), p75: percentile(values, 75), p95: percentile(values, 95) }
    })

  // --- Geo-split real-user TTFB (hot window). Uses the page_load perf row's
  // `responseStart` (context.ttfb) — the distance-sensitive server round-trip —
  // grouped by country and by distance to the Boston origin. ---
  const ttfb_rows = shared_db.prepare(`
    SELECT json_extract(context, '$.ttfb') ttfb, country, latitude, longitude
    FROM client_logs
    WHERE received_at >= ? AND message = 'perf' AND ${audience_filter}
      AND json_extract(context, '$.name') = 'page_load'
      AND json_extract(context, '$.ttfb') IS NOT NULL
  `).all(window_start_iso) as { ttfb: number, country: string | null, latitude: number | null, longitude: number | null }[]

  const ttfb_by_country_values = new Map<string, number[]>()
  const ttfb_by_distance_values = new Map<string, number[]>()
  for (const row of ttfb_rows) {
    if (typeof row.ttfb !== 'number')
      continue
    if (row.country) {
      if (!ttfb_by_country_values.has(row.country))
        ttfb_by_country_values.set(row.country, [])
      ttfb_by_country_values.get(row.country)?.push(row.ttfb)
    }
    const km = distance_to_origin_km({ latitude: row.latitude, longitude: row.longitude })
    if (km !== null) {
      if (!ttfb_by_distance_values.has(distance_bucket(km)))
        ttfb_by_distance_values.set(distance_bucket(km), [])
      ttfb_by_distance_values.get(distance_bucket(km))?.push(row.ttfb)
    }
  }

  const ttfb_by_country: GeoLatency[] = [...ttfb_by_country_values.entries()]
    .map(([label, values]) => ({ label, count: values.length, p50: percentile(values, 50), p95: percentile(values, 95) }))
    .sort((first, second) => second.count - first.count)
    .slice(0, TOP_LIMIT)
  // Distance buckets stay in ascending geographic order (not sorted by count) so
  // the latency-rises-with-distance shape reads top-to-bottom.
  const ttfb_by_distance: GeoLatency[] = DISTANCE_BUCKETS
    .filter(bucket => ttfb_by_distance_values.has(bucket))
    .map((bucket) => {
      const values = ttfb_by_distance_values.get(bucket) ?? []
      return { label: bucket, count: values.length, p50: percentile(values, 50), p95: percentile(values, 95) }
    })

  const areas = [...area_counts.entries()]
    .map(([key, value]) => ({ key, country: value.country, sessions: value.sessions }))
    .sort((first, second) => second.sessions - first.sessions)
    .slice(0, TOP_LIMIT)
  const located_sessions = [...area_counts.values()].reduce((sum, area) => sum + area.sessions, 0)
  const geo: GeoAnalytics = { located_sessions, areas, ttfb_by_country, ttfb_by_distance }

  // --- Errors by build version (hot window only — app_version isn't in the
  // rollup). Splits error volume into the live deployed build vs any stale build
  // so deploy-tail noise on not-yet-refreshed tabs is legible vs real errors. ---
  const version_error_rows = shared_db.prepare(`
    SELECT app_version version, COUNT(*) errors FROM client_logs
    WHERE received_at >= ? AND level IN ${ERROR_LEVELS_SQL}
    GROUP BY app_version
  `).all(window_start_iso) as { version: string | null, errors: number }[]
  let version_current_errors = 0
  let version_stale_errors = 0
  const error_versions = version_error_rows
    .map((row) => {
      const is_current = current_app_version != null && row.version === current_app_version
      if (is_current)
        version_current_errors += row.errors
      else
        version_stale_errors += row.errors
      return { version: row.version, errors: row.errors, is_current }
    })
    .sort((first, second) => second.errors - first.errors)
  const version_total_errors = version_current_errors + version_stale_errors
  const errors_by_version: ErrorsByVersion = {
    current_version: current_app_version ?? null,
    total: version_total_errors,
    current: version_current_errors,
    stale: version_stale_errors,
    stale_pct: version_total_errors > 0 ? version_stale_errors / version_total_errors : null,
    versions: error_versions,
  }

  // --- Pipeline health: ingestion liveness. Broken vs no-traffic at a glance. ---
  const last_log_at = (shared_db.prepare(`SELECT MAX(received_at) v FROM client_logs`).get() as { v: string | null }).v
  const last_session_start_at = (shared_db.prepare(`SELECT MAX(received_at) v FROM client_logs WHERE message = 'session_start'`).get() as { v: string | null }).v
  const last_server_log_at = (shared_db.prepare(`SELECT MAX(received_at) v FROM client_logs WHERE source = 'server'`).get() as { v: string | null }).v
  const retention_ran_at = (shared_db.prepare(`SELECT value FROM db_metadata WHERE key = 'log_retention_ran_at'`).get() as { value: string } | undefined)?.value ?? null
  const hot_rows = (shared_db.prepare(`SELECT COUNT(*) n FROM client_logs`).get() as { n: number }).n
  let archived_rows: number
  try {
    archived_rows = (get_log_archive_db().prepare(`SELECT COUNT(*) n FROM client_logs`).get() as { n: number }).n
  } catch {
    archived_rows = 0
  }
  const pipeline: PipelineHealth = { last_log_at, last_session_start_at, last_server_log_at, retention_ran_at, hot_rows, archived_rows }

  // --- Event coverage: declared analytics events vs what's actually been seen.
  // `event_counts` already holds the per-event hot+cold counts (infra excluded). ---
  const coverage_events = ALL_TRACKED_EVENTS.map((event) => {
    const count = event_counts.get(event) ?? 0
    return { event, seen: count > 0, count }
  })
  const event_coverage: EventCoverage = {
    events: coverage_events,
    never_emitted: coverage_events.filter(entry => !entry.seen).length,
  }

  // --- Leader-worker health: the live_query_* family (hot window). ---
  const leader_count = (message: string) => (shared_db.prepare(
    `SELECT COUNT(*) n FROM client_logs WHERE received_at >= ? AND message = ?`,
  ).get(window_start_iso, message) as { n: number }).n
  const failed_no_leader = (shared_db.prepare(`
    SELECT COUNT(*) n FROM client_logs
    WHERE received_at >= ? AND message = 'live_query_failed' AND json_extract(context, '$.had_leader') = 0
  `).get(window_start_iso) as { n: number }).n
  const failed_by_source = shared_db.prepare(`
    SELECT coalesce(json_extract(context, '$.source'), 'unknown') source, COUNT(*) count
    FROM client_logs WHERE received_at >= ? AND message = 'live_query_failed'
    GROUP BY source ORDER BY count DESC
  `).all(window_start_iso) as { source: string, count: number }[]
  const leader_health: LeaderHealth = {
    timeouts: leader_count('live_query_timeout'),
    recovered: leader_count('live_query_recovered'),
    failed: leader_count('live_query_failed'),
    failed_no_leader,
    failed_by_source,
  }

  return {
    audience,
    window_days: days,
    generated_at: now.toISOString(),
    daily,
    totals: {
      sessions: daily.reduce((sum, point) => sum + point.sessions, 0),
      errors: daily.reduce((sum, point) => sum + point.errors, 0),
      logs: daily.reduce((sum, point) => sum + point.logs, 0),
      unique_users,
    },
    top_routes: to_sorted(route_counts, 'route') as { route: string, count: number }[],
    top_events: to_sorted(event_counts, 'event') as { event: string, count: number }[],
    by_source,
    error_clusters,
    browsers,
    capability: { total_sessions: session_rows.length - bot_sessions, below_capability_sessions, bot_sessions, db_tiers },
    performance: { summary: perf_summary, daily: perf_daily },
    web_vitals,
    geo,
    errors_by_version,
    pipeline,
    event_coverage,
    leader_health,
  }
}
