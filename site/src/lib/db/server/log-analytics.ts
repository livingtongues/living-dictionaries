import type Database from 'better-sqlite3'
import type { DeviceType } from '$lib/debug/parse-user-agent'
import { version } from '$app/environment'
import { is_expected_error_response, is_known_noise } from '$lib/debug/classify-error'
import { ALL_TRACKED_EVENTS } from '$lib/debug/log-events'
import { is_below_db_worker_capability, is_bot_user_agent, parse_user_agent } from '$lib/debug/parse-user-agent'
import { SYNCABLE_TABLE_NAMES } from '$lib/db/sync/types'
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
const ROUTE_PERF_LIMIT = 12

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
/** A distinct deployed build seen in the window (`app_version` = build epoch ms), for timeline markers. */
export interface Deploy { day: string, version: string, first_seen: string, sessions: number }
export interface PerfSummary { name: string, count: number, p50: number | null, p90: number | null, p95: number | null, max: number | null, slowest: { duration_ms: number, route: string } | null }
export interface PerfDailyPoint { day: string, metrics: Record<string, { p50: number, p95: number, count: number }> }
/** Per-route `page_load` timing (hot window) — slowest routes (by p95) first. */
export interface RoutePerf { route: string, count: number, p50: number | null, p95: number | null, max: number | null }
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
  /**
   * Syncable tables declared in `SYNCABLE_TABLE_NAMES` but ABSENT from
   * `shared.db` — schema drift from an in-place-edited/consolidated migration
   * that never re-ran (the `dictionary_partners` incident). Non-empty = admin
   * sync is 500-ing (or skip-logging) on these; ship a backfill migration.
   */
  missing_syncable_tables: string[]
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
  /**
   * Failed-query `context.code` histogram. Distinguishes a corrupt/NOTADB local
   * DB (self-heals on a wipe-and-refetch) from a wedged-leader `timeout`/RPC
   * fault. `unknown` = code wasn't captured.
   */
  failed_by_code: { code: string, count: number }[]
  /** Failures emitted by the CURRENT deployed build — a live regression. */
  failed_current: number
  /** Failures from any stale (cached) build — usually self-heals on reload/update. */
  failed_stale: number
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
  /** Distinct builds seen in the window (first-seen day per `app_version`) — timeline deploy markers. */
  deploys: Deploy[]
  totals: { sessions: number, errors: number, logs: number, unique_users: number }
  top_routes: { route: string, count: number }[]
  top_events: { event: string, count: number }[]
  by_source: { source: string, logs: number, errors: number }[]
  /** Grouped error classes (message + stack head), real errors first, known-noise sunk. Always ALL rows. */
  error_clusters: ErrorCluster[]
  /**
   * Per-session device / OS / browser breakdown + local-DB capability (hot window
   * only — neither the raw UA nor the session_start db_tier is in the rollup). All
   * counts are HUMAN sessions; bots are tallied separately in `bot_sessions`.
   */
  capability: {
    total_sessions: number
    below_capability_sessions: number
    bot_sessions: number
    /** Coarse form factor split, sorted desc. */
    devices: { device: DeviceType, sessions: number }[]
    /** OS mix with per-OS version sub-buckets (for the nested donut), sorted desc. */
    os: { os: string, sessions: number, versions: { version: string, sessions: number }[] }[]
    /** Browser-family mix (Chrome / Safari / …), sorted desc. */
    browsers: { browser: string, sessions: number }[]
    /** Local-DB engine tier the session actually ran (logged-only). */
    db_tiers: { tier: string, sessions: number }[]
  }
  /** Client `perf` timings (hot window only — percentiles aren't in the rollup). */
  performance: { summary: PerfSummary[], daily: PerfDailyPoint[], by_route: RoutePerf[] }
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

/** Strip a full URL down to its pathname (+ search) for display; falls back to the raw value. */
function url_route(url: string | null | undefined): string {
  if (!url)
    return '?'
  try {
    const parsed = new URL(url)
    return parsed.pathname + parsed.search
  } catch {
    return url
  }
}

if (import.meta.vitest) {
  describe(url_route, () => {
    it('strips origin to pathname + search', () => {
      expect(url_route('https://new.livingdictionaries.app/example/entries?q=cat')).toBe('/example/entries?q=cat')
    })
    it('returns pathname for a bare path url', () => {
      expect(url_route('https://new.livingdictionaries.app/about')).toBe('/about')
    })
    it('falls back to the raw value for a non-url', () => {
      expect(url_route('not a url')).toBe('not a url')
    })
    it('returns ? for null/empty', () => {
      expect(url_route(null)).toBe('?')
      expect(url_route(undefined)).toBe('?')
    })
  })
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
  // metric namespace (`''` for humans, `'bot:'` for bots). A row is a bot when
  // its UA matches the crawler/headless regex OR `context.webdriver` is set
  // (headed Playwright/Selenium — a plain Chrome UA the regex can't catch; M1).
  // `webdriver` is stamped on every row of an automated session, so the per-row
  // check excludes the whole session. Server rows (NULL UA, no webdriver) stay
  // human.
  const is_bot_row = `(is_bot_ua(user_agent) = 1 OR coalesce(json_extract(context, '$.webdriver'), 0) = 1)`
  const audience_filter = audience === 'bots'
    ? `(user_agent IS NOT NULL AND ${is_bot_row})`
    : `(NOT ${is_bot_row})`
  // Map a stored rollup metric → the metric for THIS audience, or null to skip.
  const rollup_metric = (metric: string): string | null => {
    const is_bot_metric = metric.startsWith('bot:')
    if (audience === 'bots')
      return is_bot_metric ? metric.slice(4) : null
    return is_bot_metric ? null : metric
  }

  // The daily series + the usage breakdowns both consume the same `log_daily_metrics`
  // rollup rows, so `build_daily_series` reads them ONCE and hands them on (keeps the
  // query count identical to the old inline form).
  const { daily, rollup_rows, live_by_day } = build_daily_series({ shared_db, window_start_iso, window_start_day, audience_filter, rollup_metric, days, now })
  // `area_counts` is seeded from the cold `geo:` rollup here, then the hot session
  // loop in `build_capability` mutates it further — so it's threaded through both.
  const { event_counts, top_events, top_routes, by_source, area_counts } = build_usage_and_areas({ shared_db, window_start_iso, audience_filter, rollup_rows, live_by_day, rollup_metric })

  const error_clusters = build_error_clusters({ shared_db, window_start_iso })

  const unique_users = (shared_db.prepare(`
    SELECT COUNT(DISTINCT user_id) count FROM client_logs WHERE received_at >= ? AND user_id IS NOT NULL AND ${audience_filter}
  `).get(window_start_iso) as { count: number }).count

  // Device / OS / browser + capability breakdown (mutates `area_counts` with the
  // hot per-session area tally — see the threading note above).
  const capability = build_capability({ shared_db, window_start_iso, audience, area_counts })

  const performance = build_performance({ shared_db, window_start_iso, audience_filter, daily })
  const web_vitals = build_web_vitals({ shared_db, window_start_iso, audience_filter })
  const { ttfb_by_country, ttfb_by_distance } = build_ttfb_latency({ shared_db, window_start_iso, audience_filter })
  const geo = build_geo_areas({ area_counts, ttfb_by_country, ttfb_by_distance })

  const errors_by_version = build_errors_by_version({ shared_db, window_start_iso, current_app_version })
  const deploys = build_deploys({ shared_db, window_start_iso, audience_filter })
  const pipeline = build_pipeline_health({ shared_db })

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

  const leader_health = build_leader_health({ shared_db, window_start_iso, current_app_version })

  return {
    audience,
    window_days: days,
    generated_at: now.toISOString(),
    daily,
    deploys,
    totals: {
      sessions: daily.reduce((sum, point) => sum + point.sessions, 0),
      errors: daily.reduce((sum, point) => sum + point.errors, 0),
      logs: daily.reduce((sum, point) => sum + point.logs, 0),
      unique_users,
    },
    top_routes,
    top_events,
    by_source,
    error_clusters,
    capability,
    performance,
    web_vitals,
    geo,
    errors_by_version,
    pipeline,
    event_coverage,
    leader_health,
  }
}

// ---------------------------------------------------------------------------
// Section builders. Each owns ONE panel's read + shaping (same SQL/behavior as
// the inline blocks they replaced). The daily/usage/capability/geo trio is
// coupled: `build_daily_series` reads the rollup rows ONCE and passes them to
// `build_usage_and_areas`, which seeds the `area_counts` map that
// `build_capability` then mutates with the hot per-session tally before
// `build_geo_areas` finalizes it. See `.issues/log-review-followups-2026-06-29.md` (N3).
// ---------------------------------------------------------------------------

interface RollupRow { day: string, metric: string, source: string, value: number }

/**
 * Zero-filled ascending daily series (sessions/users/errors/logs), live hot rows
 * taking precedence per day with the `log_daily_metrics` rollup filling archived
 * (cold) days. Returns the raw rollup rows + the per-day live index so the usage
 * builder can reuse them without a second query.
 */
function build_daily_series({ shared_db, window_start_iso, window_start_day, audience_filter, rollup_metric, days, now }: {
  shared_db: Database.Database
  window_start_iso: string
  window_start_day: string
  audience_filter: string
  rollup_metric: (metric: string) => string | null
  days: number
  now: Date
}): { daily: DailyPoint[], rollup_rows: RollupRow[], live_by_day: Map<string, DailyPoint> } {
  // Bot/headless rows excluded so the sessions/users/logs/errors trend reflects real people.
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

  const rollup_rows = shared_db.prepare(`
    SELECT day, metric, source, value FROM log_daily_metrics WHERE day >= ?
  `).all(window_start_day) as RollupRow[]
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

  const daily: DailyPoint[] = []
  for (let offset = days - 1; offset >= 0; offset--) {
    const day = day_string(new Date(now.getTime() - offset * 86_400_000))
    daily.push(live_by_day.get(day) ?? rollup_by_day.get(day) ?? { day, sessions: 0, users: 0, errors: 0, logs: 0 })
  }
  return { daily, rollup_rows, live_by_day }
}

/**
 * Top events (infra excluded), top routes (normalized), source split, and the
 * cold-day geo area seed — all live hot rows + the rollup (cold days only).
 * Returns the still-mutable `area_counts` map (hot per-session areas are added
 * later by `build_capability`) plus `event_counts` for the coverage panel.
 */
function build_usage_and_areas({ shared_db, window_start_iso, audience_filter, rollup_rows, live_by_day, rollup_metric }: {
  shared_db: Database.Database
  window_start_iso: string
  audience_filter: string
  rollup_rows: RollupRow[]
  live_by_day: Map<string, DailyPoint>
  rollup_metric: (metric: string) => string | null
}): {
  event_counts: Map<string, number>
  top_events: { event: string, count: number }[]
  top_routes: { route: string, count: number }[]
  by_source: { source: string, logs: number, errors: number }[]
  area_counts: Map<string, { country: string, sessions: number }>
} {
  const event_counts = new Map<string, number>()
  for (const row of shared_db.prepare(`
    SELECT message event, COUNT(*) count FROM client_logs
    WHERE received_at >= ? AND level = 'info' AND ${audience_filter} GROUP BY message
  `).all(window_start_iso) as { event: string, count: number }[]) {
    if (!INFRA_EVENTS.has(row.event))
      bump(event_counts, row.event, row.count)
  }
  const route_counts = new Map<string, number>()
  for (const row of shared_db.prepare(`
    SELECT json_extract(context, '$.to') to_path, COUNT(*) count FROM client_logs
    WHERE received_at >= ? AND message = 'navigation' AND ${audience_filter} GROUP BY to_path
  `).all(window_start_iso) as { to_path: string | null, count: number }[]) {
    bump(route_counts, normalize_route(row.to_path), row.count)
  }
  // Geo areas: per-area distinct HUMAN sessions, cold (rollup `geo:` metrics,
  // bot-free at rollup time) here + hot (the session loop) later.
  const area_counts = new Map<string, { country: string, sessions: number }>()
  // Source split: bot client rows excluded; server rows (NULL UA) kept.
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

  return {
    event_counts,
    top_events: to_sorted(event_counts, 'event') as { event: string, count: number }[],
    top_routes: to_sorted(route_counts, 'route') as { route: string, count: number }[],
    by_source,
    area_counts,
  }
}

/**
 * Per-session device / OS / browser + local-DB capability breakdown (hot window
 * only — neither the raw user_agent nor the session_start db_tier is in the
 * rollup). Bots/automation counted separately + kept OUT of the human breakdown.
 * SIDE EFFECT: adds the hot per-session area tally into `area_counts`.
 */
function build_capability({ shared_db, window_start_iso, audience, area_counts }: {
  shared_db: Database.Database
  window_start_iso: string
  audience: Audience
  area_counts: Map<string, { country: string, sessions: number }>
}): LogAnalytics['capability'] {
  const session_rows = shared_db.prepare(`
    SELECT json_extract(context, '$.session_id') sid,
           MAX(user_agent) user_agent,
           MAX(json_extract(context, '$.db_tier')) db_tier,
           MAX(country) country,
           MAX(region) region,
           MAX(coalesce(json_extract(context, '$.webdriver'), 0)) webdriver
    FROM client_logs
    WHERE received_at >= ? AND json_extract(context, '$.session_id') IS NOT NULL
    GROUP BY sid
  `).all(window_start_iso) as { sid: string, user_agent: string | null, db_tier: string | null, country: string | null, region: string | null, webdriver: number }[]

  const device_counts = new Map<DeviceType, number>()
  // OS → { sessions, version → sessions }. Nested for the sunburst donut.
  const os_counts = new Map<string, { sessions: number, versions: Map<string, number> }>()
  const browser_counts = new Map<string, number>()
  const tier_counts = new Map<string, number>()
  let below_capability_sessions = 0
  let bot_sessions = 0
  for (const row of session_rows) {
    // Bot when the UA matches the crawler/headless regex OR the session is
    // automated (`navigator.webdriver` — headed Playwright/Selenium; M1).
    const is_bot = is_bot_user_agent(row.user_agent) || row.webdriver === 1
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
    // and skew the human device/OS/browser mix — count them separately but keep
    // them OUT of the breakdown. This panel stays human-only regardless of toggle.
    if (is_bot) {
      bot_sessions++
      continue
    }
    const parsed = parse_user_agent(row.user_agent)
    const below = is_below_db_worker_capability(parsed)
    if (below)
      below_capability_sessions++
    device_counts.set(parsed.device, (device_counts.get(parsed.device) ?? 0) + 1)
    const os_entry = os_counts.get(parsed.os) ?? { sessions: 0, versions: new Map<string, number>() }
    os_entry.sessions++
    bump(os_entry.versions, parsed.os_version ?? 'unknown')
    os_counts.set(parsed.os, os_entry)
    bump(browser_counts, parsed.browser)
    // Only count the engine tier we actually LOGGED on session_start. Sessions from
    // before that logging existed (db_tier null) are dropped rather than bucketed as
    // a misleading "unknown (legacy)" — they age out of the hot window anyway.
    if (row.db_tier)
      bump(tier_counts, row.db_tier)
  }
  const devices = [...device_counts.entries()]
    .map(([device, sessions]) => ({ device, sessions }))
    .sort((a, b) => b.sessions - a.sessions)
  const os = [...os_counts.entries()]
    .map(([name, value]) => ({
      os: name,
      sessions: value.sessions,
      versions: [...value.versions.entries()]
        .map(([version, sessions]) => ({ version, sessions }))
        .sort((a, b) => b.sessions - a.sessions),
    }))
    .sort((a, b) => b.sessions - a.sessions)
  const browsers = [...browser_counts.entries()]
    .map(([browser, sessions]) => ({ browser, sessions }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, TOP_LIMIT)
  const db_tiers = [...tier_counts.entries()]
    .map(([tier, sessions]) => ({ tier, sessions }))
    .sort((a, b) => b.sessions - a.sessions)

  return { total_sessions: session_rows.length - bot_sessions, below_capability_sessions, bot_sessions, devices, os, browsers, db_tiers }
}

/** Finalize geo: rank the (now fully-populated) area tally + attach the TTFB splits. */
function build_geo_areas({ area_counts, ttfb_by_country, ttfb_by_distance }: {
  area_counts: Map<string, { country: string, sessions: number }>
  ttfb_by_country: GeoLatency[]
  ttfb_by_distance: GeoLatency[]
}): GeoAnalytics {
  const areas = [...area_counts.entries()]
    .map(([key, value]) => ({ key, country: value.country, sessions: value.sessions }))
    .sort((first, second) => second.sessions - first.sessions)
    .slice(0, TOP_LIMIT)
  const located_sessions = [...area_counts.values()].reduce((sum, area) => sum + area.sessions, 0)
  return { located_sessions, areas, ttfb_by_country, ttfb_by_distance }
}

/**
 * Grouped error classes (message + stack head), real errors first, known-noise +
 * expected-response rows sunk. Always ALL rows — a bot's real error still matters.
 */
function build_error_clusters({ shared_db, window_start_iso }: { shared_db: Database.Database, window_start_iso: string }): ErrorCluster[] {
  return (shared_db.prepare(`
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
    .map(row => ({ ...row, is_noise: is_known_noise(row.message) || is_expected_error_response(row.message) }))
    .sort((first, second) => Number(first.is_noise) - Number(second.is_noise) || second.count - first.count)
}

/**
 * Client `perf` timings, hot window only (the rollup keeps event counts, not
 * duration distributions). `web_vital` rows carry `value` not `duration_ms`, so
 * the `duration_ms > 0` filter drops them from the timing mix (and drops
 * bfcache/instant-nav 0ms loads + negatives that drag the p50 down). Includes
 * the per-route page-load split (slowest p95 first).
 */
function build_performance({ shared_db, window_start_iso, audience_filter, daily }: { shared_db: Database.Database, window_start_iso: string, audience_filter: string, daily: DailyPoint[] }): { summary: PerfSummary[], daily: PerfDailyPoint[], by_route: RoutePerf[] } {
  const perf_rows = shared_db.prepare(`
    SELECT substr(received_at, 1, 10) day,
           json_extract(context, '$.name') name,
           json_extract(context, '$.duration_ms') duration_ms,
           url
    FROM client_logs
    WHERE received_at >= ? AND message = 'perf' AND ${audience_filter}
      AND json_extract(context, '$.duration_ms') > 0
  `).all(window_start_iso) as { day: string, name: string | null, duration_ms: number, url: string | null }[]

  const perf_all = new Map<string, number[]>()
  const perf_by_day = new Map<string, Map<string, number[]>>()
  const perf_slowest = new Map<string, { duration_ms: number, route: string }>()
  for (const row of perf_rows) {
    if (!row.name)
      continue
    if (!perf_all.has(row.name))
      perf_all.set(row.name, [])
    perf_all.get(row.name)?.push(row.duration_ms)
    const prev = perf_slowest.get(row.name)
    if (!prev || row.duration_ms > prev.duration_ms)
      perf_slowest.set(row.name, { duration_ms: row.duration_ms, route: url_route(row.url) })
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
  const summary: PerfSummary[] = perf_names.map((name) => {
    const values = perf_all.get(name) ?? []
    return { name, count: values.length, p50: percentile(values, 50), p90: percentile(values, 90), p95: percentile(values, 95), max: values.length ? Math.max(...values) : null, slowest: perf_slowest.get(name) ?? null }
  })
  const daily_perf: PerfDailyPoint[] = daily.map((point) => {
    const day_map = perf_by_day.get(point.day)
    const metrics: PerfDailyPoint['metrics'] = {}
    if (day_map) {
      for (const [name, values] of day_map) {
        metrics[name] = { p50: percentile(values, 50) ?? 0, p95: percentile(values, 95) ?? 0, count: values.length }
      }
    }
    return { day: point.day, metrics }
  })

  // Per-route page-load timings: group page_load samples by normalized route
  // (same buckets as the routes panel) so the slowest routes are legible (L2).
  const route_perf_values = new Map<string, number[]>()
  for (const row of perf_rows) {
    if (row.name !== 'page_load' || !row.url)
      continue
    // `url_route` → pathname+search; strip the query so `?q=…` doesn't fragment routes.
    const route = normalize_route(url_route(row.url).split('?')[0])
    if (!route_perf_values.has(route))
      route_perf_values.set(route, [])
    route_perf_values.get(route)?.push(row.duration_ms)
  }
  const by_route: RoutePerf[] = [...route_perf_values.entries()]
    .map(([route, values]) => ({ route, count: values.length, p50: percentile(values, 50), p95: percentile(values, 95), max: Math.max(...values) }))
    .sort((first, second) => (second.p95 ?? 0) - (first.p95 ?? 0))
    .slice(0, ROUTE_PERF_LIMIT)

  return { summary, daily: daily_perf, by_route }
}

/**
 * Core Web Vitals (hot window). `web_vital` perf rows carry `value` (ms, or
 * unitless for CLS) not `duration_ms`, aggregated separately from the timing mix.
 * p75 is the canonical CWV threshold.
 */
function build_web_vitals({ shared_db, window_start_iso, audience_filter }: { shared_db: Database.Database, window_start_iso: string, audience_filter: string }): WebVitalSummary[] {
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
  return web_vital_names
    .filter(name => web_vital_values.has(name))
    .map((name) => {
      const values = web_vital_values.get(name) ?? []
      return { metric: name, count: values.length, p50: percentile(values, 50), p75: percentile(values, 75), p95: percentile(values, 95) }
    })
}

/**
 * Geo-split real-user TTFB (hot window). Uses the page_load perf row's
 * `responseStart` (context.ttfb) — the distance-sensitive server round-trip —
 * grouped by country and by distance to the Boston origin.
 */
function build_ttfb_latency({ shared_db, window_start_iso, audience_filter }: { shared_db: Database.Database, window_start_iso: string, audience_filter: string }): { ttfb_by_country: GeoLatency[], ttfb_by_distance: GeoLatency[] } {
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
  return { ttfb_by_country, ttfb_by_distance }
}

/**
 * Errors split by build version (hot window only — app_version isn't in the
 * rollup). Live deployed build vs any stale build, so deploy-tail noise on
 * not-yet-refreshed tabs is legible vs real errors.
 */
function build_errors_by_version({ shared_db, window_start_iso, current_app_version }: { shared_db: Database.Database, window_start_iso: string, current_app_version: string | null }): ErrorsByVersion {
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
  return {
    current_version: current_app_version ?? null,
    total: version_total_errors,
    current: version_current_errors,
    stale: version_stale_errors,
    stale_pct: version_total_errors > 0 ? version_stale_errors / version_total_errors : null,
    versions: error_versions,
  }
}

/**
 * Distinct builds seen in the window (app_version = build epoch ms), first-seen
 * day each, for timeline markers ("which deploy caused this spike?"). Human rows
 * only so it lines up with the (bot-excluded) traffic/error charts.
 */
function build_deploys({ shared_db, window_start_iso, audience_filter }: { shared_db: Database.Database, window_start_iso: string, audience_filter: string }): Deploy[] {
  return (shared_db.prepare(`
    SELECT app_version version, MIN(received_at) first_seen,
           COUNT(DISTINCT json_extract(context, '$.session_id')) sessions
    FROM client_logs
    WHERE received_at >= ? AND app_version IS NOT NULL AND ${audience_filter}
    GROUP BY app_version ORDER BY first_seen
  `).all(window_start_iso) as { version: string, first_seen: string, sessions: number }[])
    .map(row => ({ ...row, day: row.first_seen.slice(0, 10) }))
}

/** Ingestion liveness — broken vs no-traffic at a glance (all-time, not windowed). */
function build_pipeline_health({ shared_db }: { shared_db: Database.Database }): PipelineHealth {
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
  const existing_tables = new Set(
    (shared_db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all() as { name: string }[])
      .map(row => row.name),
  )
  const missing_syncable_tables = SYNCABLE_TABLE_NAMES.filter(name => !existing_tables.has(name))
  return { last_log_at, last_session_start_at, last_server_log_at, retention_ran_at, hot_rows, archived_rows, missing_syncable_tables }
}

/** Leader-worker DB health: the live_query_* family (hot window). */
function build_leader_health({ shared_db, window_start_iso, current_app_version }: { shared_db: Database.Database, window_start_iso: string, current_app_version: string }): LeaderHealth {
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
  const failed_by_code = shared_db.prepare(`
    SELECT coalesce(json_extract(context, '$.code'), 'unknown') code, COUNT(*) count
    FROM client_logs WHERE received_at >= ? AND message = 'live_query_failed'
    GROUP BY code ORDER BY count DESC
  `).all(window_start_iso) as { code: string, count: number }[]
  const failed_current = (shared_db.prepare(`
    SELECT COUNT(*) n FROM client_logs
    WHERE received_at >= ? AND message = 'live_query_failed' AND app_version = ?
  `).get(window_start_iso, current_app_version) as { n: number }).n
  const failed = leader_count('live_query_failed')
  return {
    timeouts: leader_count('live_query_timeout'),
    recovered: leader_count('live_query_recovered'),
    failed,
    failed_no_leader,
    failed_by_source,
    failed_by_code,
    failed_current,
    failed_stale: failed - failed_current,
  }
}
