import type Database from 'better-sqlite3'
import type { DeviceType } from '$lib/debug/parse-user-agent'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { version } from '$app/environment'
import { is_expected_error_response, is_known_noise, is_noise_error_message } from '$lib/debug/classify-error'
import { ALL_TRACKED_EVENTS, DICTIONARY_OPENED, ENTRY_CREATED, ENTRY_DELETED } from '$lib/debug/log-events'
import { is_below_db_worker_capability, is_bot_user_agent, parse_user_agent } from '$lib/debug/parse-user-agent'
import { SYNCABLE_TABLE_NAMES } from '$lib/db/sync/types'
import { distance_bucket, DISTANCE_BUCKETS, distance_to_origin_km } from '$lib/geo/distance'
import { geo_key } from '$lib/server/geo-from-request'
import type { HostStats } from '$lib/server/host-stats'
import { read_host_stats } from '$lib/server/host-stats'
import { get_admin_user_ids } from './admin-user-ids'
import { classify_ua_frequency_bot_sessions, MIN_UA_BOT_SESSIONS_PER_DAY } from './bot-sessions'
import { get_log_archive_db } from './log-archive-db'
import { get_rollup_watermark, month_string, normalize_route, prev_month, SESSION_START, SITE_SCOPE } from './log-retention-cron'
import { get_logs_db } from './logs-db'
import { get_shared_db } from './shared-db'

/**
 * Server-side analytics for `/admin/analytics`. Three data tiers, merged PER DAY:
 *
 *   1. shared.db rollups (`log_daily_metrics` + `log_daily_sessions`) for every
 *      day up to the retention cron's finalization watermark — trusted verbatim,
 *      no raw-row work;
 *   2. live scans of `logs.db` raw rows for days PAST the watermark (usually just
 *      today), plus full-hot-window scans for the panels whose semantics need raw
 *      rows (error clusters, per-route session breadth, perf percentiles, server
 *      faults, boot cascade, i18n gaps, v1 activity, leader health) — those ride
 *      the slice indexes so they stay cheap;
 *   3. dev fallback: no watermark (the cron never runs) → everything live,
 *      exactly the pre-rollup behavior.
 *
 * NOT synced local-first; this is operator data queried from the server like the
 * rest of the admin DB ops. Raw `client_logs` live in `logs.db` (split out of
 * shared.db 2026-07-05); rollups + `db_metadata` live in shared.db.
 */

const ERROR_LEVELS_SQL = `('error','unhandled_rejection','crash')`
/** Infra/telemetry plumbing excluded from the "top events" list so real analytics events surface. */
const INFRA_EVENTS = new Set(['heartbeat', 'navigation', 'perf', 'session_start', 'visibility_visible', 'visibility_hidden', 'uptime_probe', 'host_stats'])
const TOP_LIMIT = 12
const ERROR_CLUSTER_LIMIT = 25
const ROUTE_PERF_LIMIT = 12
const TOP_DICTIONARIES_LIMIT = 30
/**
 * Errors within this window of their build's first appearance count as post-deploy
 * "settling" churn (chunk/asset races on a fresh bundle), NOT a standing regression —
 * so a burst right after a deploy, even on the CURRENT build, auto-explains. Ported
 * from tutor's deploy-tail fold; LD's `stale_errors` only caught OLD-build churn.
 */
const DEPLOY_TAIL_MINUTES = 30

/**
 * The global Humans/Bots toggle. Usage/engagement/geo/perf panels re-filter by
 * this; diagnostics (error_clusters / errors_by_version / leader_health) always
 * show ALL rows — a bot hitting a real error is still a real signal. We want to be
 * AI-agent- + SEO-friendly, so bot traffic is viewable, not just excluded.
 *
 * Humans = server rows (NULL UA) + non-bot UAs; Bots = client rows classified as a
 * crawler (UA regex OR navigator.webdriver OR a UA-frequency crawler session). The
 * cold rollup is read from the matching metric namespace (`''` humans, `'bot:'` bots).
 */
export type Audience = 'humans' | 'bots'

/**
 * Register `is_noise_msg(message)` — 1 when a logged error is a KNOWN-benign
 * class (stale-chunk 404s after a deploy, WebGL-unavailable, socket aborts, …)
 * or an EXPECTED HTTP response (401/403/404 gates), 0 for a real fault. Same
 * predicate the error-cluster panel uses per-row + the retention cron's
 * `real_errors` rollup, so the daily "real errors" line, the cluster `is_noise`
 * flag, and rolled-up days all agree.
 */
const is_noise_msg_registered = new WeakSet<Database.Database>()
function ensure_is_noise_msg(db: Database.Database): void {
  if (is_noise_msg_registered.has(db))
    return
  db.function('is_noise_msg', { deterministic: true }, (message: unknown) => {
    const text = typeof message === 'string' ? message : null
    return is_noise_error_message(text) ? 1 : 0
  })
  is_noise_msg_registered.add(db)
}

/**
 * Timing metrics surfaced on the performance panel, in display order.
 * `navigation` is the client-side SPA nav duration (home→entry etc), folded in
 * from the already-logged `navigation` events — no dedicated perf row.
 */
const PERF_METRICS = ['page_load', 'navigation', 'dict_boot', 'search'] as const
/** Core Web Vitals surfaced on the dashboard, in display order (the canonical CWV trio first). */
const WEB_VITAL_METRICS = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'] as const

/**
 * `stale_errors` = error-level rows emitted by a NON-current `app_version`
 * (deploy-day churn: stale tabs failing on old chunks). Hot-window only — cold
 * rollup days report 0 (app_version isn't in the rollup). The deploy-day fold:
 * a spike that's mostly stale_errors auto-explains as deploy churn.
 */
export interface DailyPoint { day: string, sessions: number, users: number, errors: number, real_errors: number, stale_errors: number, logs: number }
/** A distinct deployed build seen in the window (`app_version` = build epoch ms), for timeline markers. */
export interface Deploy { day: string, version: string, first_seen: string, sessions: number }
export interface PerfSummary { name: string, count: number, p50: number | null, p90: number | null, p95: number | null, max: number | null, slowest: { duration_ms: number, route: string } | null }
export interface PerfDailyPoint { day: string, metrics: Record<string, { p50: number, p95: number, count: number }> }
/** Per-route `page_load` timing (hot window) — slowest routes (by p95) first. */
export interface RoutePerf { route: string, count: number, p50: number | null, p95: number | null, max: number | null }
/**
 * Plain-language SPA-navigation split: `entering_dictionary` = a hop from outside
 * any dictionary (home, /dictionaries, …) into one — the hop that may pay the
 * cold dict-DB snapshot download; `within_dictionary` = hops between pages of a
 * dictionary (warm, should feel instant). The 2026-07-10 review had to hand-split
 * these; averaged together the cold first-hop hides inside the warm numbers.
 */
export interface NavSection { section: 'entering_dictionary' | 'within_dictionary' | 'other', count: number, p50: number | null, p90: number | null, p95: number | null }
/** One side (cold or warm) of the dict-DB boot distribution. */
export interface DictBootSide { count: number, p50: number | null, p90: number | null, p95: number | null }
/**
 * Dictionary local-DB boot timing from the worker-emitted `dict_boot` perf rows
 * (`dict-instance.ts`): cold = the OPFS file was absent so the boot downloaded a
 * snapshot (or a MemoryVFS boot); warm = the on-device copy opened in place.
 * Directly measures the one segment of the homepage→dictionary journey that SPA
 * `navigation` timings can only imply. Emitting from 2026-07-10 — empty until a
 * deploy carries the emitter.
 */
export interface DictBootPerf {
  total: number
  cold: DictBootSide
  warm: DictBootSide
  /** Typical (p50) snapshot download size on cold boots, in bytes; null when unknown. */
  cold_snapshot_bytes_p50: number | null
  /** Slowest dictionaries first (by cold p50, warm p50 as fallback). */
  by_dictionary: { dictionary_id: string, name: string | null, url: string | null, count: number, cold_count: number, cold_p50: number | null, warm_p50: number | null, max: number | null }[]
  daily: { day: string, cold_count: number, warm_count: number, cold_p50: number | null, cold_p95: number | null }[]
}
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
  /** Real-user LCP split by country (hot window — the `web_vital` LCP value). */
  lcp_by_country: GeoLatency[]
  /** Real-user LCP split by distance to Boston (hot window) — surfaces the far-region cold-snapshot p95 tail. */
  lcp_by_distance: GeoLatency[]
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
  /**
   * Errors (any build, incl. the current one) that landed within DEPLOY_TAIL_MINUTES
   * of that build's first appearance — post-deploy settling churn, not a standing bug.
   * A current-build error spike that's mostly this is a deploy blip, not a regression.
   */
  deploy_tail_errors: number
  /** deploy_tail_errors ÷ total; null when there are no hot-window errors. */
  deploy_tail_pct: number | null
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
  /** Total hot rows in `logs.db.client_logs` right now. */
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
/** One server-emitted fault class (`source='server'`, error-level), clustered by route + message. */
export interface ServerFaultCluster {
  /** `context.route` (SvelteKit route id), falling back to `context.pathname`; null for route-less faults (crons, webhooks, presigned callbacks). */
  route: string | null
  message: string
  count: number
  first_seen: string
  last_seen: string
  /** Distinct HTTP statuses seen (`context.status`), e.g. `500`; null when none carried one. */
  statuses: string | null
  /** SqliteError / `no such column|table` — the post-migration schema-drift class; fix-now. */
  is_schema_drift: boolean
}
/**
 * Server-side faults isolated from the client error soup. Unlike client errors
 * (stale bundles, cross-origin scripts, scanners) a `source='server'` error is
 * almost always a real, current-code regression. The schema-drift flag makes a
 * dropped-column/table regression (the `dictionary_partners` class, and the
 * onondaga corrupt-snapshot / redirect-500 faults) impossible to miss after a
 * deploy. LD server rows often carry the drift text in `stack` (the `message` is
 * a stable label like `dictionary_create_failed`), so drift is matched against
 * message + stack head.
 */
export interface ServerFaults {
  total: number
  schema_drift_count: number
  clusters: ServerFaultCluster[]
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
  /** Distinct sessions this cluster hit (rows without a session_id — server rows — don't count). */
  sessions: number
  /** Highest row count from any ONE session — a large value is a single tab retry-storming
   * (the "⟳ loop" marker) vs many users independently hurting. Null when no session-attributed rows. */
  max_per_session: number | null
  /** Of `sessions`, how many are automated (crawler UA / `navigator.webdriver` / UA-frequency).
   * A bot hitting a real error is still real signal, so the cluster is never hidden — but a high share
   * lets the panel sink it. */
  bot_sessions: number
  /** `bot_sessions / sessions` as a 0–100 percent, or null when no session-attributed rows.
   * `> 90` renders the "mostly crawler" badge. */
  bot_pct: number | null
}
export interface LogAnalytics {
  /** Which audience these usage/geo/perf panels were computed for. */
  audience: Audience
  window_days: number
  generated_at: string
  daily: DailyPoint[]
  /** Distinct builds seen in the window (first-seen day per `app_version`) — timeline deploy markers. */
  deploys: Deploy[]
  totals: { sessions: number, errors: number, real_errors: number, stale_errors: number, logs: number, unique_users: number }
  /**
   * Ranked by distinct sessions (hot window), raw nav count as tiebreak/display.
   * Raw counts alone are misleading: one search-heavy session logged 1,869
   * same-route navs (2026-07-03) and outranked every real route 4×.
   */
  top_routes: { route: string, count: number, sessions: number }[]
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
    /** Subset of bot_sessions flagged by `navigator.webdriver` (automation, often UA-spoofed). */
    webdriver_sessions: number
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
  performance: {
    summary: PerfSummary[]
    daily: PerfDailyPoint[]
    /** Per-route page-load (hard load) timing, slowest p95 first. */
    by_route: RoutePerf[]
    /** Per-destination-route client SPA navigation timing (home→entry etc), most-travelled first. */
    nav_by_route: RoutePerf[]
    /** SPA navigation split by section: entering a dictionary (cold hop) vs within one (warm). */
    nav_sections: NavSection[]
    /** Dictionary local-DB boot timing, cold (snapshot download) vs warm (on-device). */
    dict_boot: DictBootPerf
    /** Per-landing-route LCP (largest contentful paint), most-sampled first. */
    lcp_by_route: RoutePerf[]
  }
  /** Core Web Vitals distribution (hot window, human sessions only). Empty array when none landed yet. */
  web_vitals: WebVitalSummary[]
  /** Approximate geography from CF edge headers — areas + geo-split TTFB. */
  geo: GeoAnalytics
  /** Errors split by current vs stale build version (hot window only). */
  errors_by_version: ErrorsByVersion
  /** Ingestion liveness — broken vs no-traffic at a glance. */
  pipeline: PipelineHealth
  /** Server-emitted faults (`source='server'`, error-level), schema-drift flagged — the "fix now" set. */
  server_faults: ServerFaults
  /** Declared analytics events vs what's actually been seen. */
  event_coverage: EventCoverage
  /** Leader-worker DB health (live_query_* family). */
  leader_health: LeaderHealth
  /** Sync health — the `sync_failed` family (client_behind storm detector), invisible to every other panel. */
  sync_health: SyncHealth
  /** Build adoption — active sessions by build age; who's stranded on un-fixable old code. */
  build_adoption: BuildAdoption
  /** Server DB file + WAL sizes — the "checkpoint isn't firing" / runaway-logs catch. */
  storage: StorageHealth
  /** Agent/API write activity — the server-emitted `v1_*` events (hot window only). */
  api_v1: ApiV1Activity
  /** Entry edits by channel (UI vs agent API), forever rollup + live tail. */
  entry_edits: EntryEditChannels
  /** Per-dictionary viewership (forever rollup + live tail) — who's being viewed, how much. */
  top_dictionaries: TopDictionaries
  /** Top missing i18n keys — the live translation-gap worklist (hot window, human). */
  missing_i18n_keys: MissingI18nKeys
  /** Fresh-viewer boot-cascade health — empty-dictionary regression detector (hot window, audience). */
  boot_health: BootHealth
  /** Synthetic external uptime + latency (`uptime_probe`, hot window only). */
  uptime: UptimeSummary
  /**
   * Whole-box host resources (live snapshot + hot-window trend from `host_stats`).
   * Always null from `get_log_analytics` (the cached blob must not carry a "live"
   * reading) — the analytics API endpoint injects it fresh for level-3 admins.
   */
  host: HostStatsSummary | null
}

/** One day of synthetic-probe availability + latency (hot window). */
export interface UptimeDailyPoint { day: string, probes: number, up: number, ttfb_p50: number | null, ttfb_p95: number | null }
/**
 * Synthetic external uptime + latency, from the `uptime_probe` server-log family
 * (an off-box monitor hits the site every ~5 min and POSTs `{ status, ok, ttfb_ms,
 * total_ms, vantage }`). A fixed-vantage signal with NONE of the device/geo noise
 * of the client web-vital TTFB. CAVEAT: a probe can only record when `/api/log`
 * (same origin) is reachable, so `availability` is the ok-rate of *recorded*
 * probes — a full outage self-suppresses; the latency trend is the primary value.
 */
export interface UptimeSummary {
  probes: number
  /** Fraction of probes with `context.ok` truthy (0–1); null when no probe carried an `ok` field. */
  availability: number | null
  ttfb: { p50: number | null, p95: number | null }
  total: { p50: number | null, p95: number | null }
  /** Distinct `context.vantage` labels seen (probe origins). */
  vantages: string[]
  daily: UptimeDailyPoint[]
}

/**
 * Missing-translation telemetry. Each `i18n missing key: …` row is a `warn` the
 * client emits ONCE per unique key per page session (`i18n/index.ts`
 * `report_missing_translation`), so this is a clean, low-cardinality
 * translation-gap signal — a live worklist for `/translate`, not error noise.
 * Hot window only (these warn rows aren't in the rollup).
 */
export interface MissingI18nKeys {
  /** Total missing-key warn rows in the window. */
  total: number
  /** Distinct keys with no translation. */
  distinct_keys: number
  /** Distinct sessions that hit at least one missing key. */
  sessions: number
  /** Top keys by distinct sessions (then row count). */
  keys: { key: string, sessions: number, count: number, locales: string }[]
}

/**
 * Fresh-viewer boot health — the dict.db boot-cascade family
 * (`initial dict sync failed` / `Failed to read dict bundle` / `leader_boot_failed`
 * / `[orama-watcher] delta scan failed`). A spike here — especially
 * `snapshot_expired` — is the fingerprint of a snapshot-cursor regression that
 * leaves fresh public visitors on an empty dictionary (the 2026-07-04 P1 that
 * went 10h undetected because nothing surfaced it). Hot window, audience-filtered.
 */
export interface BootHealth {
  /** Distinct sessions that hit any boot-cascade error in the window. */
  failed_sessions: number
  /** Of those, sessions that went on to log `entry_opened` (recovered to real content). */
  recovered_sessions: number
  /** Share of failed sessions that never recovered, 0–1 (null when none failed). */
  non_recovery_pct: number | null
  /** Failed sessions whose cause was a `snapshot_expired` cursor gap — the regression fingerprint. */
  snapshot_expired_sessions: number
  /** Per boot-cascade signature: message (+ decoded code for the sync/bundle rows), reach, recency. */
  by_message: { message: string, code: string | null, sessions: number, count: number, last_seen: string }[]
  /** Daily distinct failed sessions — the trend line. */
  daily: { day: string, sessions: number }[]
}

/**
 * Sync health — the `sync_failed` warn/error family, which is INVISIBLE to every
 * other panel (`top_events` reads `level='info'`, `error_clusters`/`errors_by_version`
 * read only `('error','unhandled_rejection','crash')`, so `warn`-level `sync_failed`
 * falls through both). This was the single largest thing in the log stream on
 * 2026-07-05 (9,862 rows / 41.9% of the day — a `client_behind` retry storm from
 * stale tabs after a dict-schema deploy) yet showed on neither dashboard. Hot
 * window only (sync_failed isn't in the rollup). Confirms the `f66b209c` fix
 * (zero storm on the current build) and surfaces the residual stuck old-tabs.
 */
export interface SyncHealth {
  /** Total `sync_failed` rows in the hot window (all kinds). */
  total: number
  /** Per-kind volume (client_behind / network / snapshot_expired / …), current-build vs stale split, highest first. */
  by_kind: { kind: string, count: number, current: number, stale: number }[]
  /** The `client_behind` storm class specifically: current-build (should be ~0 post-fix) vs stale-build rows. */
  client_behind: { total: number, current: number, stale: number }
  /**
   * Distinct (user, dict) tabs STILL stuck on `client_behind` — a stale-build
   * client_behind row seen within the recency window (the fix can't reach a
   * backgrounded tab that never reloads; these are the ones to nudge/reload).
   */
  stuck_pairs: number
  /** Oldest first-seen among currently-stuck tabs (age-of-oldest-unresolved); null when none stuck. */
  oldest_unresolved_at: string | null
  /** Per stuck tab — who to nudge / which build to reload, most-recent first. */
  stuck: { user_id: string | null, dict_id: string | null, app_version: string | null, count: number, first_seen: string, last_seen: string }[]
}

/**
 * Build adoption — the stale-client POPULATION metric (2026-07-08 review). The
 * dashboard tracked *errors* by version but had no answer to "how many active
 * sessions are stranded on un-fixable old code?" — on 07-08, 4 clients stuck on
 * a 5-day-old build (incl. an admin) drove 67% of all error rows and were
 * invisible until a hand query. Groups the last-24h `session_start` rows by
 * `app_version` (a build epoch ms) decoded to an age bucket. Hot window only.
 */
export interface BuildAdoption {
  /** Sessions started in the recency window with any build id. */
  total: number
  /** On the live deployed build. */
  current: number
  /** On a non-current build < STALE_BUILD_DAYS old (normal deploy churn). */
  behind: number
  /** On a build ≥ STALE_BUILD_DAYS old — can't receive fixes until a hard reload. */
  stale: number
  /** Build id didn't parse as a build epoch (dev builds etc). */
  unknown: number
  /** (behind + stale) ÷ judgeable sessions — "N% of active sessions can't receive fixes". */
  stranded_pct: number | null
  /** Per-build detail: age + session count + the signed-in users on it (who to nudge). */
  builds: { app_version: string, age_days: number | null, sessions: number, users: string[], last_seen: string, is_current: boolean }[]
}

/** One server SQLite file's size + WAL footprint. `wal_ratio` > 2 = checkpoint isn't firing. */
export interface StorageDb { name: string, db_bytes: number, wal_bytes: number, wal_ratio: number | null }
/**
 * Live storage / WAL health for the server DB files (same strip house + tutor
 * run). `statSync` on the open handles' paths + an aggregate over
 * `dictionaries/*.db`. Catches both the silent "wal_checkpoint is losing to a
 * pinned reader" regression and raw-log growth (logs.db hit 467MB growing
 * ~110MB/day during the 07-08 storm). In-memory handles (tests) yield no rows.
 */
export interface StorageHealth {
  dbs: StorageDb[]
  /** Aggregate over per-dict DB files (`dictionaries/*.db`, incl. history DBs); null when the dir is absent (tests / fresh dev). */
  dict_dbs: { count: number, db_bytes: number, wal_bytes: number } | null
}

/**
 * The `/api/v1` write surface (per-dict API keys + session callers) emits one
 * server `v1_*` row per operation (`v1_entry_updated`, `v1_media_attached`, …)
 * — the single largest volume signal during an agent pass, previously
 * invisible on the dashboard. Hot window only (v1 rows aren't in the rollup).
 * Serves the human/agent editing-parity direction: agent edits should be as
 * legible as human ones.
 */
export interface ApiV1Activity {
  /** Total v1 operation rows in the hot window. */
  total: number
  /** v1 rows at an error level (e.g. `v1_feedback_failed`). */
  failures: number
  daily: { day: string, count: number, failures: number }[]
  /** Per-operation counts (`v1_entry_updated` …), highest first. */
  by_event: { event: string, count: number }[]
  /** Which dictionaries the API pass touched (`context.dictionary_id`), highest first. */
  by_dictionary: { dictionary_id: string, count: number }[]
  /** Auth channel split (`context.via`: `api_key` vs session), highest first. */
  by_via: { via: string, count: number }[]
}

/**
 * Entry edits by channel — human editing UI vs the `/api/v1` agent write surface —
 * so the UI→API transition can be watched as the write-API matures (Jacob,
 * 2026-07-17). UI = `entry_created` + `entry_deleted` client events (in-place
 * field edits aren't discrete events, so the UI line is creates + deletes only).
 * API = server `v1_entries_written` weighted by its `context.created + updated`
 * counts (one bulk row can carry thousands of entries) + `v1_entry_updated` +
 * `v1_entry_deleted` rows. Finalized days come from the forever rollup
 * (`event:entry_*` + the weighted `api_entry_edits` metric); the live tail scans
 * raw rows. Rollup days predating the `api_entry_edits` metric fall back to
 * `event:v1_*` row counts (undercounts bulk writes — better than zero).
 */
export interface EntryEditChannels {
  ui_total: number
  api_total: number
  daily: { day: string, ui: number, api: number }[]
}

/** One dictionary's viewership over the window — most-viewed first. */
export interface TopDictionaryRow {
  dictionary_id: string
  /** Catalog name (null if the dict was deleted after being viewed). */
  name: string | null
  /** Catalog url slug — links the panel row to the live dictionary. */
  url: string | null
  is_public: boolean
  /** TRUE unique visitors (distinct `visitor_id`) who opened this dictionary over
   * the rolling last 30 days. A whole-period UNION, not daily-distinct visitor-days. */
  visitors_30d: number
  /** Anonymous (logged-out) subset of `visitors_30d` ≈ outside public visitors. */
  anon_visitors_30d: number
  /** TRUE unique visitors last COMPLETE calendar month (frozen forever). */
  visitors_prev_month: number
  /** TRUE unique visitors over the rolling last 7 days (live from hot logs). */
  visitors_7d: number
  /** Visits (distinct sessions, resets per page-load) over 30d — activity context. */
  visits_30d: number
}
/**
 * Per-dictionary viewership — "which dictionaries are being viewed, by how many
 * UNIQUE visitors". The primary 30d figures UNION visitor IDs across the retained
 * hot + archive raw logs; the previous complete month comes from the forever
 * `dictionary_monthly_visitors` rollup; the rolling 7d figure scans hot logs;
 * `visits_30d` (sessions) comes from the daily rollup + live tail for activity
 * context. "Visitors" = distinct browsers/devices (cookieless `visitor_id`), not
 * humans. Bots excluded.
 */
export interface TopDictionaries {
  /** Distinct dictionaries with at least one visitor in the rolling last 30 days. */
  distinct_dictionaries: number
  /** Previous complete calendar month ('YYYY-MM' UTC), for the comparison label. */
  prev_month: string
  /** Site-wide TRUE unique visitors (distinct visitor across all sessions) — last 30d, previous month, last 7d. */
  site_visitors_30d: number
  site_visitors_prev_month: number
  site_visitors_7d: number
  /** Per-dictionary rows, most unique-visitors-this-month first (top N). */
  dictionaries: TopDictionaryRow[]
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

/**
 * The ascending daily window every zero-filled panel iterates over: today back
 * through `days - 1` days ago, oldest-first, as `YYYY-MM-DD` strings. Owns the
 * off-by-one-prone `day_string(now - offset * 86_400_000)` walk so a new daily
 * panel can't silently drift — the classic bug is zero-filling only the days that
 * had data instead of the whole window. Pair with `.map()` + per-panel `by_day`
 * Maps to build the series (live wins, then rollup, then empty). See the
 * log-analytics cross-app map for the full rollup + live-tail merge contract.
 */
function zero_fill_days({ days, now }: { days: number, now: Date }): string[] {
  const out: string[] = []
  for (let offset = days - 1; offset >= 0; offset--)
    out.push(day_string(new Date(now.getTime() - offset * 86_400_000)))
  return out
}

interface RollupRow { day: string, metric: string, source: string, value: number }

/** One window session, aggregated from the materialized finalized days + the live tail. */
interface WindowSession {
  session_id: string
  user_agent: string | null
  /** UTC day of the session's earliest row. */
  day: string
  heartbeats: number
  has_user_id: boolean
  /** 1 when any row carried `context.webdriver` (stamped on EVERY row of an automated session). */
  webdriver: number | null
  db_tier: string | null
  country: string | null
  region: string | null
  /** Signed-in user for the session — lets the geo panel exclude admin sessions. NULL = anon. */
  user_id: string | null
}

/**
 * Resolved per-call context threaded through the section builders. Holds the SQL
 * fragments + helpers the builders share: the audience filter (applied to every
 * usage/geo/perf hot query), the rollup-namespace mapper, the window bounds, the
 * finalized-rollup boundary, and the single session source every panel reuses.
 */
interface AnalyticsContext {
  shared_db: Database.Database
  /** Raw hot `client_logs` rows live here (logs.db) — every live scan uses this handle. */
  logs_db: Database.Database
  /** Aged raw `client_logs` rows retained in logs-archive.db. */
  archive_db: Database.Database | null
  audience: Audience
  /** Hot-row SQL predicate scoping to the active audience (humans / bots). */
  audience_filter: string
  /** Raw SQL predicate — 1 when a hot row is a bot (crawler UA / webdriver / UA-frequency), audience-agnostic. */
  is_bot_row: string
  /** Maps a rollup metric name into the active audience's namespace, or null to skip. */
  rollup_metric: (metric: string) => string | null
  window_start_iso: string
  window_start_day: string
  /**
   * First day NOT covered by finalized rollups — live raw-row scans for the
   * rollup-vocabulary sections start here (usually today; window_start_day when the
   * cron has never run, i.e. dev). Days before it come from shared.db rollups.
   */
  live_start_day: string
  live_start_iso: string
  /** Days (within the window, before live_start_day) covered by `log_daily_sessions` — the geo rollup loop skips these. */
  materialized_days: Set<string>
  /** Earliest day with raw rows still in hot storage ('9999-12-31' when logs.db is empty). */
  hot_min_day: string
  current_app_version: string | null
  days: number
  now: Date
  /** UA-frequency crawler + webdriver session ids in the window (JS-side classification). */
  bot_session_ids: Set<string>
  /** One row per window session (materialized finalized days + live tail) — the shared session source. */
  window_sessions: WindowSession[]
  /** Admin (level >= 2) `users.id`s — excluded from the geo area tally only. */
  admin_user_ids: Set<string>
}

interface LogAnalyticsOptions {
  shared_db?: Database.Database
  /** Raw hot log rows (logs.db). */
  logs_db?: Database.Database
  /** Raw aged log rows (logs-archive.db). */
  archive_db?: Database.Database | null
  days?: number
  now?: Date
  /** The live deployed build id; errors on any other build count as "stale". */
  current_app_version?: string | null
  /** Humans (default) or Bots — re-filters every usage/engagement/geo/perf panel. */
  audience?: Audience
  /** Per-day zero-heartbeat sessions-per-UA that flip a UA to crawler (test seam). */
  bot_ua_min_per_day?: number
  /**
   * Which panels to compute — lets each admin page skip the OTHER page's heavy
   * builders (progressive/top-down loading). Skipped sections return typed empty
   * defaults. Default `full` (back-compat — the log-review reader wants everything).
   * - `light` — core summary only (daily/deploys/totals/geo areas/capability/top
   *   events+routes/by_source/event_coverage/error_clusters/pipeline).
   * - `usage` — light + usage-heavy (api_v1 / top_dictionaries) and the
   *   performance/Web Vitals inputs used by the Experience summary.
   * - `diagnostics` — light + diagnostics-heavy (performance / web_vitals / geo
   *   latency / errors_by_version / server_faults / leader+sync health / build
   *   adoption / storage / boot_health / uptime).
   */
  scope?: AnalyticsScope
}

/** Panel-compute scope — see `LogAnalyticsOptions.scope`. */
export type AnalyticsScope = 'light' | 'usage' | 'diagnostics' | 'full'

/**
 * Memo of whole-window computes. With finalized days served from rollups +
 * slice-indexed live scans the compute is cheap, but better-sqlite3 still blocks
 * the event loop for it — and the dashboard tolerates staleness ("within a day is
 * fine"), so a generous TTL keeps audience/range flips + reloads at ~0 cost. The
 * `pipeline` liveness panel is the one thing recomputed FRESH on every call (it
 * answers "is ingest broken RIGHT NOW?" — a couple of indexed MAX lookups). Only
 * DEFAULT-arg calls are cached (a test injecting shared_db/now/… bypasses).
 */
const analytics_cache = new Map<string, { at_ms: number, value: LogAnalytics }>()
const ANALYTICS_CACHE_TTL_MS = 15 * 60_000

export function get_log_analytics(options: LogAnalyticsOptions = {}): LogAnalytics {
  const { shared_db = get_shared_db(), logs_db = get_logs_db(), days = 30, now = new Date(), current_app_version = version, audience = 'humans', bot_ua_min_per_day = MIN_UA_BOT_SESSIONS_PER_DAY, scope = 'full' } = options
  const archive_db = options.archive_db === undefined
    ? (options.logs_db === undefined ? get_log_archive_db() : null)
    : options.archive_db
  // Cache only the live-DB (default-handle) path — a test injecting a db/now/…
  // always bypasses. Checking `undefined` (never the identity of get_*_db())
  // keeps tests from touching the real .data files.
  const cacheable = options.shared_db === undefined && options.logs_db === undefined && options.archive_db === undefined && options.now === undefined
    && options.current_app_version === undefined && options.bot_ua_min_per_day === undefined
  const cache_key = `${days}:${audience}:${scope}`
  if (cacheable) {
    const hit = analytics_cache.get(cache_key)
    if (hit && now.getTime() - hit.at_ms < ANALYTICS_CACHE_TTL_MS)
      return { ...hit.value, pipeline: build_pipeline_health({ shared_db, logs_db }) }
  }
  const value = compute_log_analytics({ shared_db, logs_db, archive_db, days, now, current_app_version, audience, bot_ua_min_per_day, scope })
  if (cacheable)
    analytics_cache.set(cache_key, { at_ms: now.getTime(), value })
  return value
}

/** Per-section timing, printed when ANALYTICS_PROFILE=1 (e.g. a scratch vitest run on a real DB copy). */
const PROFILE = process.env.ANALYTICS_PROFILE === '1'
function timed<T>(label: string, fn: () => T): T {
  if (!PROFILE)
    return fn()
  const start = performance.now()
  const result = fn()
  // eslint-disable-next-line no-console
  console.log(`[profile] ${label}: ${(performance.now() - start).toFixed(1)}ms`)
  return result
}

/**
 * Typed empty defaults for the heavy, page-specific sections a scoped compute
 * skips. Shapes are tsc-enforced against the `LogAnalytics` field types, so a
 * schema change here fails the build rather than shipping a wrong-shaped panel.
 */
const EMPTY_PERFORMANCE: LogAnalytics['performance'] = {
  summary: [], daily: [], by_route: [], nav_by_route: [], nav_sections: [], lcp_by_route: [],
  dict_boot: { total: 0, cold: { count: 0, p50: null, p90: null, p95: null }, warm: { count: 0, p50: null, p90: null, p95: null }, cold_snapshot_bytes_p50: null, by_dictionary: [], daily: [] },
}
const EMPTY_WEB_VITALS: LogAnalytics['web_vitals'] = []
const EMPTY_ERRORS_BY_VERSION: LogAnalytics['errors_by_version'] = { current_version: '', total: 0, current: 0, stale: 0, stale_pct: null, deploy_tail_errors: 0, deploy_tail_pct: null, versions: [] }
const EMPTY_SERVER_FAULTS: LogAnalytics['server_faults'] = { total: 0, schema_drift_count: 0, clusters: [] }
const EMPTY_LEADER_HEALTH: LogAnalytics['leader_health'] = { timeouts: 0, recovered: 0, failed: 0, failed_no_leader: 0, failed_by_source: [], failed_by_code: [], failed_current: 0, failed_stale: 0 }
const EMPTY_SYNC_HEALTH: LogAnalytics['sync_health'] = { total: 0, by_kind: [], client_behind: { total: 0, current: 0, stale: 0 }, stuck_pairs: 0, oldest_unresolved_at: null, stuck: [] }
const EMPTY_BUILD_ADOPTION: LogAnalytics['build_adoption'] = { total: 0, current: 0, behind: 0, stale: 0, unknown: 0, stranded_pct: null, builds: [] }
const EMPTY_STORAGE: LogAnalytics['storage'] = { dbs: [], dict_dbs: null }
const EMPTY_BOOT_HEALTH: LogAnalytics['boot_health'] = { failed_sessions: 0, recovered_sessions: 0, non_recovery_pct: null, snapshot_expired_sessions: 0, by_message: [], daily: [] }
const EMPTY_UPTIME: LogAnalytics['uptime'] = { probes: 0, availability: null, ttfb: { p50: null, p95: null }, total: { p50: null, p95: null }, vantages: [], daily: [] }
const EMPTY_API_V1: LogAnalytics['api_v1'] = { total: 0, failures: 0, daily: [], by_event: [], by_dictionary: [], by_via: [] }
const EMPTY_ENTRY_EDITS: LogAnalytics['entry_edits'] = { ui_total: 0, api_total: 0, daily: [] }
const EMPTY_TOP_DICTIONARIES: LogAnalytics['top_dictionaries'] = { distinct_dictionaries: 0, prev_month: '', site_visitors_30d: 0, site_visitors_prev_month: 0, site_visitors_7d: 0, dictionaries: [] }
const EMPTY_MISSING_I18N: LogAnalytics['missing_i18n_keys'] = { total: 0, distinct_keys: 0, sessions: 0, keys: [] }
const EMPTY_EVENT_COVERAGE: LogAnalytics['event_coverage'] = { events: [], never_emitted: 0 }
const EMPTY_GEO_LATENCY: { ttfb_by_country: GeoLatency[], ttfb_by_distance: GeoLatency[], lcp_by_country: GeoLatency[], lcp_by_distance: GeoLatency[] } = { ttfb_by_country: [], ttfb_by_distance: [], lcp_by_country: [], lcp_by_distance: [] }

function compute_log_analytics({ shared_db, logs_db, archive_db, days, now, current_app_version, audience, bot_ua_min_per_day, scope }: Required<Omit<LogAnalyticsOptions, 'current_app_version'>> & { current_app_version: string | null }): LogAnalytics {
  // Which heavy, cleanly-independent builders to run this compute (the shared
  // core always runs). `light` = neither; each page's tier requests its own half.
  const want_usage = scope === 'usage' || scope === 'full'
  const want_diagnostics = scope === 'diagnostics' || scope === 'full'
  const want_experience = want_usage || want_diagnostics
  ensure_is_noise_msg(logs_db)
  const window_start = new Date(now.getTime() - (days - 1) * 86_400_000)
  const window_start_day = day_string(window_start)
  const window_start_iso = `${window_start_day}T00:00:00.000Z`

  // Finalized-rollup boundary: days up to the retention cron's watermark come
  // from shared.db rollups; live raw-row scans start the day after (clamped to
  // the window). No watermark (dev — the cron never runs) → everything live.
  const watermark = get_rollup_watermark(shared_db)
  const after_watermark = watermark ? day_string(new Date(new Date(`${watermark}T00:00:00.000Z`).getTime() + 86_400_000)) : window_start_day
  const live_start_day = after_watermark > window_start_day ? after_watermark : window_start_day
  const live_start_iso = `${live_start_day}T00:00:00.000Z`

  // ONE session source feeds all session-shaped classification (see WindowSession):
  // materialized finalized days from `log_daily_sessions` + the live tail, merged
  // by session_id so a boundary/midnight-spanning session still counts once.
  const { window_sessions, materialized_days } = timed('query_window_sessions', () => query_window_sessions({ shared_db, logs_db, window_start_day, live_start_day, live_start_iso }))
  const freq_bot_sessions = classify_ua_frequency_bot_sessions({ sessions: window_sessions, min_per_day: bot_ua_min_per_day })
  const webdriver_session_ids = window_sessions.filter(session => session.webdriver === 1).map(session => session.session_id)
  const bot_session_ids = new Set([...freq_bot_sessions, ...webdriver_session_ids])

  // Crawler UAs actually seen in the HOT window, classified ONCE in JS (few
  // hundred distinct strings). The temp sets only filter live raw-row scans.
  const window_uas = timed('distinct_uas', () => logs_db.prepare(`
    SELECT DISTINCT user_agent FROM client_logs WHERE received_at >= ? AND user_agent IS NOT NULL
  `).all(window_start_iso) as { user_agent: string }[])
  const bot_uas = window_uas.map(row => row.user_agent).filter(ua => is_bot_user_agent(ua))

  // Audience filter for hot rows — pure column probes against two TEMP sets (no
  // JS UDF, no per-row context JSON parse; the old ~seconds-long freeze). A row is
  // a bot when its UA is a known crawler UA, OR its session is webdriver-automated
  // / a UA-frequency crawler. Server rows (NULL UA, NULL session_id) stay human —
  // CRITICAL: coalesce the IN probes or a NULL column yields NULL and breaks NOT.
  populate_temp_set({ logs_db, table: 'analytics_bot_uas', column: 'user_agent', values: bot_uas })
  populate_temp_set({ logs_db, table: 'analytics_bot_sessions', column: 'session_id', values: bot_session_ids })
  const is_bot_row = `(coalesce(user_agent IN (SELECT user_agent FROM analytics_bot_uas), 0) = 1 OR coalesce(session_id IN (SELECT session_id FROM analytics_bot_sessions), 0) = 1)`
  const audience_filter = audience === 'bots'
    ? `(user_agent IS NOT NULL AND ${is_bot_row})`
    : `(NOT ${is_bot_row})`
  const rollup_metric = (metric: string): string | null => {
    const is_bot_metric = metric.startsWith('bot:')
    if (audience === 'bots')
      return is_bot_metric ? metric.slice(4) : null
    return is_bot_metric ? null : metric
  }

  const hot_min_day = (logs_db.prepare(`SELECT substr(MIN(received_at), 1, 10) day FROM client_logs`).get() as { day: string | null }).day ?? '9999-12-31'

  const admin_user_ids = get_admin_user_ids({ shared_db })
  const ctx: AnalyticsContext = { shared_db, logs_db, archive_db, audience, audience_filter, is_bot_row, rollup_metric, window_start_iso, window_start_day, live_start_day, live_start_iso, materialized_days, hot_min_day, current_app_version, days, now, bot_session_ids, window_sessions, admin_user_ids }

  const { daily, rollup_rows, live_by_day } = timed('build_daily_series', () => build_daily_series(ctx))
  // `area_counts` is seeded from the cold `geo:` rollup here, then the window-session
  // loop in `build_capability` mutates it further — so it's threaded through both.
  const { event_counts, top_events, top_routes, by_source, area_counts } = timed('build_usage_and_areas', () => build_usage_and_areas({ ctx, rollup_rows, live_by_day }))

  const error_clusters = timed('build_error_clusters', () => build_error_clusters(ctx))
  const unique_users = timed('build_unique_users', () => build_unique_users(ctx))
  const capability = timed('build_capability', () => build_capability({ ctx, area_counts }))
  // Performance/Web Vitals also feed Analytics' Experience summary; the other
  // latency breakdowns remain diagnostics-only. The light tier skips both.
  const performance = want_experience ? timed('build_performance', () => build_performance({ ctx, daily })) : EMPTY_PERFORMANCE
  const web_vitals = want_experience ? timed('build_web_vitals', () => build_web_vitals(ctx)) : EMPTY_WEB_VITALS
  const geo_latency = want_diagnostics ? timed('build_geo_latency', () => build_geo_latency(ctx)) : EMPTY_GEO_LATENCY
  // `geo` areas stay core (both pages); only the TTFB/LCP latency splits are diagnostics-gated.
  const geo = build_geo_areas({ area_counts, ttfb_by_country: geo_latency.ttfb_by_country, ttfb_by_distance: geo_latency.ttfb_by_distance, lcp_by_country: geo_latency.lcp_by_country, lcp_by_distance: geo_latency.lcp_by_distance })
  const errors_by_version = want_diagnostics ? timed('build_errors_by_version', () => build_errors_by_version(ctx)) : EMPTY_ERRORS_BY_VERSION
  const deploys = timed('build_deploys', () => build_deploys(ctx))
  const pipeline = timed('build_pipeline', () => build_pipeline_health({ shared_db, logs_db }))
  const server_faults = want_diagnostics ? timed('build_server_faults', () => build_server_faults(ctx)) : EMPTY_SERVER_FAULTS

  // event_coverage is a usage panel — cheap, but gated with the usage tier.
  const event_coverage: EventCoverage = want_usage
    ? (() => {
        const coverage_events = ALL_TRACKED_EVENTS.map((event) => {
          const count = event_counts.get(event) ?? 0
          return { event, seen: count > 0, count }
        })
        return { events: coverage_events, never_emitted: coverage_events.filter(entry => !entry.seen).length }
      })()
    : EMPTY_EVENT_COVERAGE

  const leader_health = want_diagnostics ? timed('build_leader_health', () => build_leader_health(ctx)) : EMPTY_LEADER_HEALTH
  const sync_health = want_diagnostics ? timed('build_sync_health', () => build_sync_health(ctx)) : EMPTY_SYNC_HEALTH
  const build_adoption = want_diagnostics ? timed('build_build_adoption', () => build_build_adoption(ctx)) : EMPTY_BUILD_ADOPTION
  const storage = want_diagnostics ? timed('build_storage', () => build_storage({ shared_db, logs_db })) : EMPTY_STORAGE
  // Usage-heavy (analytics page only) — skipped for the diagnostics/light tiers.
  const api_v1 = want_usage ? timed('build_api_v1', () => build_api_v1_activity(ctx)) : EMPTY_API_V1
  const entry_edits = want_usage ? timed('build_entry_edits', () => build_entry_edit_channels({ ctx, rollup_rows, live_by_day })) : EMPTY_ENTRY_EDITS
  const top_dictionaries = want_usage ? timed('build_top_dictionaries', () => build_top_dictionaries(ctx)) : EMPTY_TOP_DICTIONARIES
  const missing_i18n_keys = scope === 'full' ? timed('build_missing_i18n', () => build_missing_i18n_keys(ctx)) : EMPTY_MISSING_I18N
  const boot_health = want_diagnostics ? timed('build_boot_health', () => build_boot_health(ctx)) : EMPTY_BOOT_HEALTH
  const uptime = want_diagnostics ? timed('build_uptime', () => build_uptime(ctx)) : EMPTY_UPTIME

  return {
    audience,
    window_days: days,
    generated_at: now.toISOString(),
    daily,
    deploys,
    totals: {
      sessions: daily.reduce((sum, point) => sum + point.sessions, 0),
      errors: daily.reduce((sum, point) => sum + point.errors, 0),
      real_errors: daily.reduce((sum, point) => sum + point.real_errors, 0),
      stale_errors: daily.reduce((sum, point) => sum + point.stale_errors, 0),
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
    server_faults,
    event_coverage,
    leader_health,
    sync_health,
    build_adoption,
    storage,
    api_v1,
    entry_edits,
    top_dictionaries,
    missing_i18n_keys,
    boot_health,
    uptime,
    // Never computed here (this result is cached 15 min — a "live" reading must
    // not ride it). The analytics API endpoint injects a fresh section for
    // level-3 admins; everyone else sees null.
    host: null,
  }
}

/** One hour of `host_stats` samples — avg + max of the per-5-min window averages. */
export interface HostHourlyPoint {
  /** 'YYYY-MM-DDTHH:00' (UTC hour, matching `received_at`). */
  hour: string
  cpu_avg: number | null
  /** The hottest 5-min window that hour — the burst signal a mean hides. */
  cpu_max: number | null
  mem_avg: number | null
  mem_max: number | null
  disk_pct: number | null
}
/**
 * Whole-box host resources (CPU / RAM / disk) from the `host_stats` server-log
 * family (a 5-min cron reads /proc from inside the container — host values are
 * not namespaced; see host-stats.ts). `now` is a live reading taken while this
 * response was built; `latest`/`hourly` come from logged samples (hot window).
 */
export interface HostStatsSummary {
  now: HostStats | null
  samples: number
  latest: (HostStats & { at: string }) | null
  hourly: HostHourlyPoint[]
}

/**
 * Build the host-resources section: live snapshot + hot-window hourly trend.
 * Reads raw `host_stats` rows only (they age out of logs.db with retention, so
 * the file itself IS the hot window — no date filter needed). Called fresh per
 * request by the analytics API endpoint (NOT inside the cached analytics blob).
 */
export function build_host_stats({ logs_db, read_now = () => read_host_stats({ tracker: 'health-request' }) }: {
  logs_db: Database.Database
  read_now?: () => HostStats
}): HostStatsSummary {
  let now: HostStats | null
  try {
    now = read_now()
  } catch {
    now = null // /proc unavailable (non-Linux dev) — panel falls back to logged samples
  }

  const samples = (logs_db.prepare(`
    SELECT COUNT(*) count FROM client_logs WHERE source = 'server' AND message = 'host_stats'
  `).get() as { count: number }).count

  let latest: HostStatsSummary['latest'] = null
  const latest_row = logs_db.prepare(`
    SELECT received_at, context FROM client_logs
    WHERE source = 'server' AND message = 'host_stats'
    ORDER BY received_at DESC LIMIT 1
  `).get() as { received_at: string, context: string | null } | undefined
  if (latest_row?.context) {
    try {
      latest = { ...(JSON.parse(latest_row.context) as HostStats), at: latest_row.received_at }
    } catch {
      latest = null
    }
  }

  const hourly = logs_db.prepare(`
    SELECT substr(received_at, 1, 13) || ':00'                        hour,
           ROUND(AVG(json_extract(CASE WHEN json_valid(context) THEN context END, '$.cpu_pct')), 1)          cpu_avg,
           MAX(json_extract(CASE WHEN json_valid(context) THEN context END, '$.cpu_pct'))                    cpu_max,
           ROUND(AVG(json_extract(CASE WHEN json_valid(context) THEN context END, '$.mem_pct')), 1)          mem_avg,
           MAX(json_extract(CASE WHEN json_valid(context) THEN context END, '$.mem_pct'))                    mem_max,
           MAX(json_extract(CASE WHEN json_valid(context) THEN context END, '$.disk_pct'))                   disk_pct
    FROM client_logs
    WHERE source = 'server' AND message = 'host_stats'
    GROUP BY hour
    ORDER BY hour
  `).all() as HostHourlyPoint[]

  return { now, samples, latest, hourly }
}

/**
 * THE session source — one row per window session. Finalized days come from
 * shared.db's `log_daily_sessions` materialization; only the live tail (>=
 * live_start_iso, usually today) scans raw rows. The two are re-grouped by
 * session_id so a session spanning the boundary (or midnight) counts once with
 * summed heartbeats — matching the old whole-window GROUP BY.
 */
function query_window_sessions({ shared_db, logs_db, window_start_day, live_start_day, live_start_iso }: {
  shared_db: Database.Database
  logs_db: Database.Database
  window_start_day: string
  live_start_day: string
  live_start_iso: string
}): { window_sessions: WindowSession[], materialized_days: Set<string> } {
  const materialized = shared_db.prepare(`
    SELECT day, session_id, user_agent, heartbeats, has_user_id, webdriver, db_tier, country, region, user_id
    FROM log_daily_sessions
    WHERE day >= ? AND day < ?
    ORDER BY day
  `).all(window_start_day, live_start_day) as (Omit<WindowSession, 'has_user_id'> & { has_user_id: number })[]

  const live = logs_db.prepare(`
    SELECT session_id,
           MAX(user_agent) user_agent,
           substr(MIN(received_at), 1, 10) day,
           SUM(CASE WHEN message = 'heartbeat' THEN 1 ELSE 0 END) heartbeats,
           MAX(CASE WHEN user_id IS NOT NULL THEN 1 ELSE 0 END) has_user_id,
           MAX(json_extract(CASE WHEN json_valid(context) THEN context END, '$.webdriver')) webdriver,
           MAX(json_extract(CASE WHEN json_valid(context) THEN context END, '$.db_tier')) db_tier,
           MAX(country) country,
           MAX(region) region,
           MAX(user_id) user_id
    FROM client_logs
    WHERE received_at >= ? AND session_id IS NOT NULL
    GROUP BY session_id
  `).all(live_start_iso) as (Omit<WindowSession, 'has_user_id'> & { has_user_id: number })[]

  const materialized_days = new Set(materialized.map(row => row.day))
  const merged = new Map<string, WindowSession>()
  for (const row of [...materialized, ...live]) {
    const existing = merged.get(row.session_id)
    if (!existing) {
      merged.set(row.session_id, { ...row, has_user_id: row.has_user_id === 1, webdriver: row.webdriver === 1 ? 1 : (row.webdriver ?? null) })
      continue
    }
    // Materialized rows come first (ascending day), so `existing.day` stays the
    // session's earliest day — matching the old MIN(received_at) grouping.
    existing.heartbeats += row.heartbeats
    existing.has_user_id = existing.has_user_id || row.has_user_id === 1
    existing.webdriver = existing.webdriver === 1 || row.webdriver === 1 ? 1 : (existing.webdriver ?? (row.webdriver ?? null))
    existing.user_agent = existing.user_agent ?? row.user_agent
    existing.db_tier = existing.db_tier ?? row.db_tier
    existing.country = existing.country ?? row.country
    existing.region = existing.region ?? row.region
    existing.user_id = existing.user_id ?? row.user_id
  }
  return { window_sessions: [...merged.values()], materialized_days }
}

/**
 * Materialize a set into a per-connection TEMP table so the SQL audience filter
 * can probe it (`x IN (SELECT … FROM <table>)`). Refilled each call (idempotent
 * DELETE + insert), always present (even empty) so the subquery is valid. The
 * shared connection means concurrent analytics requests share these tables —
 * acceptable because the dashboard is admin-only + read-only.
 */
function populate_temp_set({ logs_db, table, column, values }: {
  logs_db: Database.Database
  table: 'analytics_bot_sessions' | 'analytics_bot_uas'
  column: 'session_id' | 'user_agent'
  values: Iterable<string>
}): void {
  logs_db.exec(`CREATE TEMP TABLE IF NOT EXISTS ${table} (${column} TEXT PRIMARY KEY)`)
  const insert = logs_db.prepare(`INSERT OR IGNORE INTO ${table} (${column}) VALUES (?)`)
  const refill = logs_db.transaction((items: string[]) => {
    logs_db.prepare(`DELETE FROM ${table}`).run()
    for (const item of items)
      insert.run(item)
  })
  refill([...values])
}

/**
 * Synthetic uptime + latency from the `uptime_probe` server-log family (hot window).
 * Server rows carry no user_agent, so this is audience-independent — always shown.
 * The mustang off-box prober POSTs `{ status, ok, ttfb_ms, total_ms, vantage }` to
 * `/api/log` (trusted `X-Log-Source-Secret` path → `source='server'`) every few min.
 */
function build_uptime(ctx: AnalyticsContext): UptimeSummary {
  const rows = ctx.logs_db.prepare(`
    SELECT substr(received_at, 1, 10)               day,
           json_extract(CASE WHEN json_valid(context) THEN context END, '$.ttfb_ms')       ttfb_ms,
           json_extract(CASE WHEN json_valid(context) THEN context END, '$.total_ms')      total_ms,
           json_extract(CASE WHEN json_valid(context) THEN context END, '$.ok')            ok,
           json_extract(CASE WHEN json_valid(context) THEN context END, '$.status')        status,
           json_extract(CASE WHEN json_valid(context) THEN context END, '$.vantage')       vantage
    FROM client_logs
    WHERE received_at >= ? AND source = 'server' AND message = 'uptime_probe'
    ORDER BY received_at
  `).all(ctx.window_start_iso) as { day: string, ttfb_ms: number | null, total_ms: number | null, ok: number | null, status: number | null, vantage: string | null }[]

  const ttfb_values: number[] = []
  const total_values: number[] = []
  const vantages = new Set<string>()
  let ok_denominator = 0
  let up = 0
  const by_day = new Map<string, { probes: number, up: number, ttfb: number[] }>()
  for (const row of rows) {
    if (typeof row.ttfb_ms === 'number')
      ttfb_values.push(row.ttfb_ms)
    if (typeof row.total_ms === 'number')
      total_values.push(row.total_ms)
    if (row.vantage)
      vantages.add(row.vantage)
    const has_ok_signal = row.ok !== null || row.status !== null
    const is_up = row.ok === 1 || (row.ok === null && row.status !== null && row.status >= 200 && row.status < 300)
    if (has_ok_signal) {
      ok_denominator++
      if (is_up)
        up++
    }
    const bucket = by_day.get(row.day) ?? { probes: 0, up: 0, ttfb: [] }
    bucket.probes++
    if (is_up)
      bucket.up++
    if (typeof row.ttfb_ms === 'number')
      bucket.ttfb.push(row.ttfb_ms)
    by_day.set(row.day, bucket)
  }

  const daily: UptimeDailyPoint[] = [...by_day.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([day, bucket]) => ({
      day,
      probes: bucket.probes,
      up: bucket.up,
      ttfb_p50: percentile(bucket.ttfb, 50),
      ttfb_p95: percentile(bucket.ttfb, 95),
    }))

  return {
    probes: rows.length,
    availability: ok_denominator > 0 ? up / ok_denominator : null,
    ttfb: { p50: percentile(ttfb_values, 50), p95: percentile(ttfb_values, 95) },
    total: { p50: percentile(total_values, 50), p95: percentile(total_values, 95) },
    vantages: [...vantages].sort(),
    daily,
  }
}

// ---------------------------------------------------------------------------
// Section builders. Each owns ONE panel's read + shaping. The daily/usage/
// capability/geo trio is coupled: `build_daily_series` reads the rollup rows ONCE
// and passes them to `build_usage_and_areas`, which seeds the `area_counts` map
// that `build_capability` then mutates with the window-session tally before
// `build_geo_areas` finalizes it.
// ---------------------------------------------------------------------------

/**
 * Zero-filled ascending daily series (sessions/users/errors/logs), live hot rows
 * (days past the watermark) taking precedence per day with the `log_daily_metrics`
 * rollup filling finalized days. Returns the raw rollup rows + the per-day live
 * index so the usage builder can reuse them without a second query.
 */
function build_daily_series(ctx: AnalyticsContext): { daily: DailyPoint[], rollup_rows: RollupRow[], live_by_day: Map<string, DailyPoint> } {
  const { logs_db, shared_db, audience_filter, rollup_metric, window_start_iso, window_start_day, live_start_iso, current_app_version } = ctx
  // Bot/headless rows excluded so the sessions/users/logs/errors trend reflects real people.
  // `real_errors` drops known-noise / expected-response rows; `stale_errors` (deploy-day fold)
  // counts errors from a non-current app_version so a redeploy burst auto-explains.
  const live_daily = logs_db.prepare(`
    SELECT substr(received_at, 1, 10) day,
           COUNT(*) logs,
           SUM(CASE WHEN level IN ${ERROR_LEVELS_SQL} THEN 1 ELSE 0 END) errors,
           SUM(CASE WHEN level IN ${ERROR_LEVELS_SQL} AND is_noise_msg(message) = 0 THEN 1 ELSE 0 END) real_errors,
           SUM(CASE WHEN level IN ${ERROR_LEVELS_SQL} AND ? IS NOT NULL AND app_version IS NOT NULL AND app_version <> ? THEN 1 ELSE 0 END) stale_errors,
           COUNT(DISTINCT user_id) users,
           COUNT(DISTINCT session_id) sessions
    FROM client_logs WHERE received_at >= ? AND ${audience_filter}
    GROUP BY day
  `).all(current_app_version, current_app_version, live_start_iso) as DailyPoint[]
  const live_by_day = new Map(live_daily.map(point => [point.day, point]))

  const rollup_rows = shared_db.prepare(`
    SELECT day, metric, source, value FROM log_daily_metrics WHERE day >= ?
  `).all(window_start_day) as RollupRow[]

  // Stale-error overlay for finalized-but-still-hot days: `stale` depends on the
  // CURRENT build id (which changes after a rollup is written), so it can't be
  // baked into the rollup — but error rows are a tiny indexed slice, so the full
  // hot window stays cheap. Archived days degrade to 0 (raw rows gone).
  const stale_by_day = new Map<string, number>()
  for (const row of logs_db.prepare(`
    SELECT substr(received_at, 1, 10) day,
           SUM(CASE WHEN is_noise_msg(message) = 0 AND ? IS NOT NULL AND app_version IS NOT NULL AND app_version <> ? THEN 1 ELSE 0 END) stale
    FROM client_logs
    WHERE received_at >= ? AND level IN ${ERROR_LEVELS_SQL} AND ${audience_filter}
    GROUP BY day
  `).all(current_app_version, current_app_version, window_start_iso) as { day: string, stale: number }[])
    stale_by_day.set(row.day, row.stale)

  const rollup_by_day = new Map<string, DailyPoint>()
  // Days whose rollup carries the `real_errors` metric (written since 2026-07-05);
  // older rollup days fall back to the raw error count below.
  const has_real_errors_metric = new Set<string>()
  for (const row of rollup_rows) {
    if (live_by_day.has(row.day))
      continue // live wins for this day
    const metric = rollup_metric(row.metric)
    if (metric === null)
      continue // wrong audience namespace
    let point = rollup_by_day.get(row.day)
    if (!point) {
      point = { day: row.day, sessions: 0, users: 0, errors: 0, real_errors: 0, stale_errors: stale_by_day.get(row.day) ?? 0, logs: 0 }
      rollup_by_day.set(row.day, point)
    }
    if (metric === 'sessions') point.sessions += row.value
    else if (metric === 'users') point.users += row.value
    else if (metric === 'errors') point.errors += row.value
    else if (metric === 'real_errors') {
      point.real_errors += row.value
      has_real_errors_metric.add(row.day)
    } else if (metric === 'logs') point.logs += row.value
  }
  // Legacy rollup days (pre-real_errors metric) fall back to the raw error count.
  for (const [day, point] of rollup_by_day) {
    if (!has_real_errors_metric.has(day))
      point.real_errors = point.errors
  }

  const daily: DailyPoint[] = zero_fill_days(ctx).map(day =>
    live_by_day.get(day) ?? rollup_by_day.get(day) ?? { day, sessions: 0, users: 0, errors: 0, real_errors: 0, stale_errors: 0, logs: 0 })
  return { daily, rollup_rows, live_by_day }
}

/**
 * Top events (infra excluded), top routes (normalized), source split, and the
 * cold-day geo area seed. Live hot rows scan the full hot window for nav (session
 * breadth needs raw rows) but only the live tail for events/source; the rollup
 * fills finalized days. Returns the still-mutable `area_counts` map (hot per-session
 * areas are added later by `build_capability`) plus `event_counts` for coverage.
 */
function build_usage_and_areas({ ctx, rollup_rows, live_by_day }: {
  ctx: AnalyticsContext
  rollup_rows: RollupRow[]
  live_by_day: Map<string, DailyPoint>
}): {
  event_counts: Map<string, number>
  top_events: { event: string, count: number }[]
  top_routes: { route: string, count: number, sessions: number }[]
  by_source: { source: string, logs: number, errors: number }[]
  area_counts: Map<string, { country: string, sessions: number }>
} {
  const { logs_db, audience_filter, rollup_metric, window_start_iso, live_start_iso, materialized_days, hot_min_day } = ctx

  // --- Top events: live tail + rollup (finalized days), infra excluded. ---
  const event_counts = new Map<string, number>()
  for (const row of logs_db.prepare(`
    SELECT message event, COUNT(*) count FROM client_logs
    WHERE received_at >= ? AND level = 'info' AND ${audience_filter} GROUP BY message
  `).all(live_start_iso) as { event: string, count: number }[]) {
    if (!INFRA_EVENTS.has(row.event))
      bump(event_counts, row.event, row.count)
  }
  // --- Top routes: live nav (normalized) over the FULL hot window + rollup nav
  // for days whose raw rows are gone. `route_counts` = raw nav rows;
  // `route_sessions` = distinct sessions per route — that per-session breadth is
  // why this scan stays full-hot-window (the rollup stores counts, not sessions). ---
  const route_counts = new Map<string, number>()
  const route_sessions = new Map<string, Set<string>>()
  for (const row of logs_db.prepare(`
    SELECT json_extract(CASE WHEN json_valid(context) THEN context END, '$.to') to_path,
           session_id sid,
           COUNT(*) count
    FROM client_logs
    WHERE received_at >= ? AND message = 'navigation' AND ${audience_filter}
    GROUP BY to_path, sid
  `).all(window_start_iso) as { to_path: string | null, sid: string | null, count: number }[]) {
    const route = normalize_route(row.to_path)
    bump(route_counts, route, row.count)
    if (row.sid) {
      const sids = route_sessions.get(route) ?? new Set<string>()
      sids.add(row.sid)
      route_sessions.set(route, sids)
    }
  }
  // Geo areas: cold-day seed (rollup `geo:` metrics, bot-free at rollup time) here;
  // hot/materialized-day sessions are added later by build_capability.
  const area_counts = new Map<string, { country: string, sessions: number }>()
  // --- Source split: live tail + rollup (finalized days). ---
  const source_logs = new Map<string, number>()
  const source_errors = new Map<string, number>()
  for (const row of logs_db.prepare(`
    SELECT coalesce(source, 'client') source, COUNT(*) logs,
           SUM(CASE WHEN level IN ${ERROR_LEVELS_SQL} THEN 1 ELSE 0 END) errors
    FROM client_logs WHERE received_at >= ? AND ${audience_filter} GROUP BY source
  `).all(live_start_iso) as { source: string, logs: number, errors: number }[]) {
    bump(source_logs, row.source, row.logs)
    bump(source_errors, row.source, row.errors)
  }

  for (const row of rollup_rows) {
    const metric = rollup_metric(row.metric)
    if (metric === null)
      continue // wrong audience namespace
    if (metric.startsWith('nav:')) {
      // Nav rollups only for days the full-window live nav scan can't see (raw rows archived).
      if (row.day < hot_min_day)
        bump(route_counts, metric.slice('nav:'.length), row.value)
      continue
    }
    if (metric.startsWith('geo:')) {
      // Geo rollups only for days the merged session source doesn't cover
      // (materialized finalized days + live-tail days count their sessions directly).
      if (!live_by_day.has(row.day) && !materialized_days.has(row.day)) {
        const key = metric.slice('geo:'.length)
        const area = area_counts.get(key) ?? { country: key.split('-')[0], sessions: 0 }
        area.sessions += row.value
        area_counts.set(key, area)
      }
      continue
    }
    if (live_by_day.has(row.day))
      continue // live wins for this day
    if (metric.startsWith('event:')) {
      const event = metric.slice('event:'.length)
      if (!INFRA_EVENTS.has(event))
        bump(event_counts, event, row.value)
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

  const top_routes = [...route_counts.entries()]
    .map(([route, count]) => ({ route, count, sessions: route_sessions.get(route)?.size ?? 0 }))
    .sort((a, b) => b.sessions - a.sessions || b.count - a.count)
    .slice(0, TOP_LIMIT)

  return {
    event_counts,
    top_events: to_sorted(event_counts, 'event') as { event: string, count: number }[],
    top_routes,
    by_source,
    area_counts,
  }
}

/**
 * Per-session device / OS / browser + local-DB capability breakdown (hot window
 * only — neither the raw user_agent nor the session_start db_tier is in the
 * rollup). One entry per session from the shared window-session source.
 * Bots/automation counted separately + kept OUT of the human breakdown.
 * SIDE EFFECT: adds the per-session area tally into `area_counts`.
 */
function build_capability({ ctx, area_counts }: {
  ctx: AnalyticsContext
  area_counts: Map<string, { country: string, sessions: number }>
}): LogAnalytics['capability'] {
  const { audience, bot_session_ids, window_sessions, admin_user_ids } = ctx
  const device_counts = new Map<DeviceType, number>()
  const os_counts = new Map<string, { sessions: number, versions: Map<string, number> }>()
  const browser_counts = new Map<string, number>()
  const tier_counts = new Map<string, number>()
  let below_capability_sessions = 0
  let bot_sessions = 0
  let webdriver_sessions = 0
  for (const row of window_sessions) {
    const is_webdriver = row.webdriver === 1
    if (is_webdriver)
      webdriver_sessions++
    const is_bot = is_bot_user_agent(row.user_agent) || is_webdriver || bot_session_ids.has(row.session_id)
    // Geo areas follow the active audience — bot check FIRST so bot sessions don't
    // leak into the human area tally. Admin sessions are excluded from geo only
    // (they skew "where visitors come from"); still counted in every other panel.
    const is_admin = !!row.user_id && admin_user_ids.has(row.user_id)
    if ((audience === 'bots') === is_bot && !is_admin) {
      const area_key = geo_key({ country: row.country, region: row.region })
      if (area_key && row.country) {
        const area = area_counts.get(area_key) ?? { country: row.country, sessions: 0 }
        area.sessions++
        area_counts.set(area_key, area)
      }
    }
    // Bots have no OPFS, never convert, skew the human device mix — count separately.
    if (is_bot) {
      bot_sessions++
      continue
    }
    const parsed = parse_user_agent(row.user_agent)
    if (is_below_db_worker_capability(parsed))
      below_capability_sessions++
    device_counts.set(parsed.device, (device_counts.get(parsed.device) ?? 0) + 1)
    const os_entry = os_counts.get(parsed.os) ?? { sessions: 0, versions: new Map<string, number>() }
    os_entry.sessions++
    bump(os_entry.versions, parsed.os_version ?? 'unknown')
    os_counts.set(parsed.os, os_entry)
    bump(browser_counts, parsed.browser)
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

  return { total_sessions: window_sessions.length - bot_sessions, below_capability_sessions, bot_sessions, webdriver_sessions, devices, os, browsers, db_tiers }
}

/** Finalize geo: rank the (now fully-populated) area tally + attach the TTFB + LCP splits. */
function build_geo_areas({ area_counts, ttfb_by_country, ttfb_by_distance, lcp_by_country, lcp_by_distance }: {
  area_counts: Map<string, { country: string, sessions: number }>
  ttfb_by_country: GeoLatency[]
  ttfb_by_distance: GeoLatency[]
  lcp_by_country: GeoLatency[]
  lcp_by_distance: GeoLatency[]
}): GeoAnalytics {
  const areas = [...area_counts.entries()]
    .map(([key, value]) => ({ key, country: value.country, sessions: value.sessions }))
    .sort((first, second) => second.sessions - first.sessions)
    .slice(0, TOP_LIMIT)
  const located_sessions = [...area_counts.values()].reduce((sum, area) => sum + area.sessions, 0)
  return { located_sessions, areas, ttfb_by_country, ttfb_by_distance, lcp_by_country, lcp_by_distance }
}

/**
 * Grouped error classes (message + stack head), real errors first, known-noise +
 * expected-response rows sunk. Always ALL rows — a bot's real error still matters.
 * Per-cluster session breadth (`sessions` / `max_per_session`) + `bot_sessions` /
 * `bot_pct` feed the "⟳ loop" and "mostly crawler" markers: a single-tab retry storm
 * or an all-crawler cluster is visibly sunk without being hidden.
 */
function build_error_clusters(ctx: AnalyticsContext): ErrorCluster[] {
  // Session breadth pass: one row per (cluster, session), classified bot/human via
  // the same temp-set predicate the audience filter uses. Server rows (NULL
  // session_id) are excluded — they have no session to loop or to be a bot.
  const per_session_rows = ctx.logs_db.prepare(`
    SELECT message,
           substr(coalesce(stack, ''), 1, 200) stack_head,
           COUNT(*) n,
           MAX(CASE WHEN ${ctx.is_bot_row} THEN 1 ELSE 0 END) is_bot
    FROM client_logs
    WHERE level IN ${ERROR_LEVELS_SQL} AND received_at >= ? AND session_id IS NOT NULL
    GROUP BY message, stack_head, session_id
  `).all(ctx.window_start_iso) as { message: string, stack_head: string, n: number, is_bot: number }[]
  const breadth = new Map<string, { sessions: number, max_per_session: number, bot_sessions: number }>()
  for (const row of per_session_rows) {
    const key = `${row.message}\u0000${row.stack_head}`
    const entry = breadth.get(key) ?? { sessions: 0, max_per_session: 0, bot_sessions: 0 }
    entry.sessions++
    entry.max_per_session = Math.max(entry.max_per_session, row.n)
    if (row.is_bot === 1)
      entry.bot_sessions++
    breadth.set(key, entry)
  }

  return (ctx.logs_db.prepare(`
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
  `).all(ctx.window_start_iso) as Omit<ErrorCluster, 'is_noise' | 'sessions' | 'max_per_session' | 'bot_sessions' | 'bot_pct'>[])
    .map((row) => {
      const cluster_breadth = breadth.get(`${row.message}\u0000${row.stack_head}`)
      const sessions = cluster_breadth?.sessions ?? 0
      const bot_sessions = cluster_breadth?.bot_sessions ?? 0
      return {
        ...row,
        is_noise: is_known_noise(row.message) || is_expected_error_response(row.message),
        sessions,
        max_per_session: cluster_breadth ? cluster_breadth.max_per_session : null,
        bot_sessions,
        bot_pct: sessions > 0 ? Math.round((bot_sessions / sessions) * 100) : null,
      }
    })
    // Real errors first, known-noise sunk to the bottom; count desc within each.
    .sort((first, second) => Number(first.is_noise) - Number(second.is_noise) || second.count - first.count)
}

/** Distinct authenticated users in the window, audience-scoped. */
function build_unique_users(ctx: AnalyticsContext): number {
  return (ctx.logs_db.prepare(`
    SELECT COUNT(DISTINCT user_id) count FROM client_logs WHERE received_at >= ? AND user_id IS NOT NULL AND ${ctx.audience_filter}
  `).get(ctx.window_start_iso) as { count: number }).count
}

/** The dropped-column/table + SqliteError class — a post-migration regression signature. */
const SCHEMA_DRIFT_PATTERN = /no such (?:column|table)|has no column named|sqliteerror/i

/**
 * Server-emitted faults (`source='server'`, error-level) clustered by route +
 * message. Server rows carry no user_agent, so this is audience-independent —
 * always shown. Schema-drift (SqliteError / `no such column|table`) is flagged so
 * a column-drop regression screams post-deploy. LD labels its server errors, so
 * the raw SqliteError text usually lives in `stack`, not `message` — drift is
 * matched against message + stack head.
 */
function build_server_faults(ctx: AnalyticsContext): ServerFaults {
  const clusters = (ctx.logs_db.prepare(`
    SELECT coalesce(json_extract(CASE WHEN json_valid(context) THEN context END, '$.route'), json_extract(CASE WHEN json_valid(context) THEN context END, '$.pathname')) route,
           message,
           substr(coalesce(stack, ''), 1, 300) stack_head,
           COUNT(*) count,
           MIN(received_at) first_seen,
           MAX(received_at) last_seen,
           group_concat(DISTINCT json_extract(CASE WHEN json_valid(context) THEN context END, '$.status')) statuses
    FROM client_logs
    WHERE received_at >= ? AND source = 'server' AND level IN ${ERROR_LEVELS_SQL}
    GROUP BY route, message
    ORDER BY last_seen DESC, count DESC
  `).all(ctx.window_start_iso) as (Omit<ServerFaultCluster, 'is_schema_drift'> & { stack_head: string })[])
    .map(({ stack_head, ...row }) => ({ ...row, is_schema_drift: SCHEMA_DRIFT_PATTERN.test(`${row.message} ${stack_head}`) }))
  return {
    total: clusters.reduce((sum, cluster) => sum + cluster.count, 0),
    schema_drift_count: clusters.filter(cluster => cluster.is_schema_drift).reduce((sum, cluster) => sum + cluster.count, 0),
    clusters,
  }
}

/** Missing-translation warn rows → a ranked, deduped translation-gap worklist. */
const MISSING_I18N_KEY_SQL = `coalesce(json_extract(CASE WHEN json_valid(context) THEN context END, '$.i18n_key'), replace(message, 'i18n missing key: ', ''))`
function build_missing_i18n_keys(ctx: AnalyticsContext): MissingI18nKeys {
  const where = `received_at >= ? AND message LIKE 'i18n missing key:%' AND ${ctx.audience_filter}`
  const summary = ctx.logs_db.prepare(`
    SELECT COUNT(*) total,
           COUNT(DISTINCT ${MISSING_I18N_KEY_SQL}) distinct_keys,
           COUNT(DISTINCT session_id) sessions
    FROM client_logs WHERE ${where}
  `).get(ctx.window_start_iso) as { total: number, distinct_keys: number, sessions: number }
  const keys = ctx.logs_db.prepare(`
    SELECT ${MISSING_I18N_KEY_SQL} key,
           COUNT(*) count,
           COUNT(DISTINCT session_id) sessions,
           group_concat(DISTINCT json_extract(CASE WHEN json_valid(context) THEN context END, '$.locale')) locales
    FROM client_logs WHERE ${where}
    GROUP BY key
    ORDER BY sessions DESC, count DESC
    LIMIT 25
  `).all(ctx.window_start_iso) as { key: string, count: number, sessions: number, locales: string }[]
  return { total: summary.total, distinct_keys: summary.distinct_keys, sessions: summary.sessions, keys }
}

/** The dict.db boot-cascade family — a failed fresh-viewer open surfaces as one or more of these. */
const BOOT_CASCADE_MESSAGES_SQL = `('initial dict sync failed', 'Failed to read dict bundle from wa-sqlite', 'leader_boot_failed', '[orama-watcher] delta scan failed')`
function build_boot_health(ctx: AnalyticsContext): BootHealth {
  const { logs_db, window_start_iso, audience_filter } = ctx
  const where = `received_at >= ? AND message IN ${BOOT_CASCADE_MESSAGES_SQL} AND ${audience_filter}`

  const summary = logs_db.prepare(`
    SELECT COUNT(DISTINCT session_id) failed_sessions,
           COUNT(DISTINCT CASE WHEN instr(coalesce(context, ''), 'snapshot_expired') > 0 THEN session_id END) snapshot_expired_sessions
    FROM client_logs WHERE ${where}
  `).get(window_start_iso) as { failed_sessions: number, snapshot_expired_sessions: number }

  // Recovered = a failed session that later logged `entry_opened` (real content rendered).
  const recovered_sessions = (logs_db.prepare(`
    SELECT COUNT(DISTINCT session_id) n FROM client_logs
    WHERE received_at >= ? AND message = 'entry_opened' AND ${audience_filter}
      AND session_id IN (SELECT DISTINCT session_id FROM client_logs WHERE ${where})
  `).get(window_start_iso, window_start_iso) as { n: number }).n

  const by_message = logs_db.prepare(`
    SELECT message,
           CASE WHEN message IN ('initial dict sync failed', 'Failed to read dict bundle from wa-sqlite')
                THEN coalesce(json_extract(CASE WHEN json_valid(context) THEN context END, '$.code'), json_extract(CASE WHEN json_valid(context) THEN context END, '$.sqlite_code_name'))
                ELSE NULL END code,
           COUNT(DISTINCT session_id) sessions,
           COUNT(*) count,
           MAX(received_at) last_seen
    FROM client_logs WHERE ${where}
    GROUP BY message, code
    ORDER BY sessions DESC, count DESC
  `).all(window_start_iso) as { message: string, code: string | null, sessions: number, count: number, last_seen: string }[]

  const daily = logs_db.prepare(`
    SELECT substr(received_at, 1, 10) day, COUNT(DISTINCT session_id) sessions
    FROM client_logs WHERE ${where}
    GROUP BY day ORDER BY day
  `).all(window_start_iso) as { day: string, sessions: number }[]

  return {
    failed_sessions: summary.failed_sessions,
    recovered_sessions,
    non_recovery_pct: summary.failed_sessions ? (summary.failed_sessions - recovered_sessions) / summary.failed_sessions : null,
    snapshot_expired_sessions: summary.snapshot_expired_sessions,
    by_message,
    daily,
  }
}

/**
 * Client `perf` timings, hot window only (the rollup keeps event counts, not
 * duration distributions). `web_vital` rows carry `value` not `duration_ms`, so
 * the `duration_ms > 0` filter drops them from the timing mix (and drops
 * bfcache/instant-nav 0ms loads + negatives that drag the p50 down). Includes the
 * per-route page-load split (slowest p95 first).
 */
function build_performance({ ctx, daily }: { ctx: AnalyticsContext, daily: DailyPoint[] }): LogAnalytics['performance'] {
  const perf_rows = ctx.logs_db.prepare(`
    SELECT substr(received_at, 1, 10) day,
           json_extract(CASE WHEN json_valid(context) THEN context END, '$.name') name,
           json_extract(CASE WHEN json_valid(context) THEN context END, '$.duration_ms') duration_ms,
           url
    FROM client_logs
    WHERE received_at >= ? AND message = 'perf' AND ${ctx.audience_filter}
      AND json_extract(CASE WHEN json_valid(context) THEN context END, '$.duration_ms') > 0
  `).all(ctx.window_start_iso) as { day: string, name: string | null, duration_ms: number, url: string | null }[]

  const perf_all = new Map<string, number[]>()
  const perf_by_day = new Map<string, Map<string, number[]>>()
  const perf_slowest = new Map<string, { duration_ms: number, route: string }>()
  const record_timing = (name: string, day: string, duration_ms: number, route: string): void => {
    if (!perf_all.has(name))
      perf_all.set(name, [])
    perf_all.get(name)?.push(duration_ms)
    const prev = perf_slowest.get(name)
    if (!prev || duration_ms > prev.duration_ms)
      perf_slowest.set(name, { duration_ms, route })
    let day_map = perf_by_day.get(day)
    if (!day_map) {
      day_map = new Map()
      perf_by_day.set(day, day_map)
    }
    if (!day_map.has(name))
      day_map.set(name, [])
    day_map.get(name)?.push(duration_ms)
  }
  for (const row of perf_rows) {
    if (!row.name)
      continue
    record_timing(row.name, row.day, row.duration_ms, url_route(row.url))
  }

  // Client-side SPA navigation timing — pulled from the already-logged
  // `navigation` events (`duration_ms` measured beforeNavigate→afterNavigate,
  // `to` = destination). This is the home→entry speed signal, folded into the
  // same summary/daily as a synthetic `navigation` metric plus a by-route split.
  // No new logging.
  const nav_rows = ctx.logs_db.prepare(`
    SELECT substr(received_at, 1, 10)              day,
           json_extract(CASE WHEN json_valid(context) THEN context END, '$.duration_ms') duration_ms,
           json_extract(CASE WHEN json_valid(context) THEN context END, '$.to')          to_path,
           json_extract(CASE WHEN json_valid(context) THEN context END, '$.from')        from_path,
           url
    FROM client_logs
    WHERE received_at >= ? AND message = 'navigation' AND ${ctx.audience_filter}
      AND json_extract(CASE WHEN json_valid(context) THEN context END, '$.duration_ms') > 0
  `).all(ctx.window_start_iso) as { day: string, duration_ms: number, to_path: string | null, from_path: string | null, url: string | null }[]
  const nav_route_values = new Map<string, number[]>()
  const nav_section_values = new Map<NavSection['section'], number[]>()
  const is_dict_route = (route: string): boolean => route.startsWith('dictionary:')
  for (const row of nav_rows) {
    const to_route = normalize_route(typeof row.to_path === 'string' ? row.to_path : (row.url ? url_route(row.url).split('?')[0] : null))
    record_timing('navigation', row.day, row.duration_ms, to_route)
    if (!nav_route_values.has(to_route))
      nav_route_values.set(to_route, [])
    nav_route_values.get(to_route)?.push(row.duration_ms)
    // Cold-vs-warm hop classification: entering a dictionary from outside pays
    // the dict-DB boot; hops within one should be near-instant.
    const from_route = normalize_route(typeof row.from_path === 'string' ? row.from_path : null)
    const section: NavSection['section'] = is_dict_route(to_route)
      ? (is_dict_route(from_route) ? 'within_dictionary' : 'entering_dictionary')
      : 'other'
    if (!nav_section_values.has(section))
      nav_section_values.set(section, [])
    nav_section_values.get(section)?.push(row.duration_ms)
  }
  const nav_sections: NavSection[] = (['entering_dictionary', 'within_dictionary', 'other'] as const)
    .filter(section => nav_section_values.has(section))
    .map((section) => {
      const values = nav_section_values.get(section) ?? []
      return { section, count: values.length, p50: percentile(values, 50), p90: percentile(values, 90), p95: percentile(values, 95) }
    })

  const perf_names = [...PERF_METRICS, ...[...perf_all.keys()].filter(name => !PERF_METRICS.includes(name as typeof PERF_METRICS[number]))]
  const summary: PerfSummary[] = perf_names.map((name) => {
    const values = perf_all.get(name) ?? []
    return { name, count: values.length, p50: percentile(values, 50), p90: percentile(values, 90), p95: percentile(values, 95), max: values.length ? Math.max(...values) : null, slowest: perf_slowest.get(name) ?? null }
  })
  const daily_perf: PerfDailyPoint[] = daily.map((point) => {
    const day_map = perf_by_day.get(point.day)
    const metrics: PerfDailyPoint['metrics'] = {}
    if (day_map) {
      for (const [name, values] of day_map)
        metrics[name] = { p50: percentile(values, 50) ?? 0, p95: percentile(values, 95) ?? 0, count: values.length }
    }
    return { day: point.day, metrics }
  })

  const route_perf_values = new Map<string, number[]>()
  for (const row of perf_rows) {
    if (row.name !== 'page_load' || !row.url)
      continue
    const route = normalize_route(url_route(row.url).split('?')[0])
    if (!route_perf_values.has(route))
      route_perf_values.set(route, [])
    route_perf_values.get(route)?.push(row.duration_ms)
  }
  const by_route: RoutePerf[] = [...route_perf_values.entries()]
    .map(([route, values]) => ({ route, count: values.length, p50: percentile(values, 50), p95: percentile(values, 95), max: Math.max(...values) }))
    .sort((first, second) => (second.p95 ?? 0) - (first.p95 ?? 0))
    .slice(0, ROUTE_PERF_LIMIT)

  // Navigation by destination route — most-travelled first (the common paths, e.g.
  // home→dictionary:entry, are what matter; slow ones surface via their p95 column).
  const nav_by_route: RoutePerf[] = [...nav_route_values.entries()]
    .map(([route, values]) => ({ route, count: values.length, p50: percentile(values, 50), p95: percentile(values, 95), max: Math.max(...values) }))
    .sort((first, second) => second.count - first.count)
    .slice(0, ROUTE_PERF_LIMIT)

  // LCP (largest contentful paint) by landing route — the real "when did they see
  // content" metric, per route. web_vital rows carry `value` (ms), only on hard loads.
  const lcp_route_values = new Map<string, number[]>()
  for (const row of ctx.logs_db.prepare(`
    SELECT url, json_extract(CASE WHEN json_valid(context) THEN context END, '$.value') value
    FROM client_logs
    WHERE received_at >= ? AND message = 'perf' AND ${ctx.audience_filter}
      AND json_extract(CASE WHEN json_valid(context) THEN context END, '$.name') = 'web_vital'
      AND json_extract(CASE WHEN json_valid(context) THEN context END, '$.metric') = 'LCP'
      AND json_extract(CASE WHEN json_valid(context) THEN context END, '$.value') > 0
  `).all(ctx.window_start_iso) as { url: string | null, value: number }[]) {
    if (!row.url)
      continue
    const route = normalize_route(url_route(row.url).split('?')[0])
    if (!lcp_route_values.has(route))
      lcp_route_values.set(route, [])
    lcp_route_values.get(route)?.push(row.value)
  }
  const lcp_by_route: RoutePerf[] = [...lcp_route_values.entries()]
    .map(([route, values]) => ({ route, count: values.length, p50: percentile(values, 50), p95: percentile(values, 95), max: Math.max(...values) }))
    .sort((first, second) => second.count - first.count)
    .slice(0, ROUTE_PERF_LIMIT)

  return { summary, daily: daily_perf, by_route, nav_by_route, nav_sections, lcp_by_route, dict_boot: build_dict_boot(ctx) }
}

/**
 * Dictionary local-DB boot timing (`dict_boot` perf rows shipped by the leader
 * worker in `dict-instance.ts`). Cold = downloaded a snapshot / MemoryVFS; warm
 * = the on-device OPFS copy opened in place. Empty until a deployed build
 * carries the emitter (2026-07-10) — the panel shows a "collecting" note.
 */
function build_dict_boot(ctx: AnalyticsContext): DictBootPerf {
  const rows = ctx.logs_db.prepare(`
    SELECT substr(received_at, 1, 10)                 day,
           json_extract(CASE WHEN json_valid(context) THEN context END, '$.duration_ms')    duration_ms,
           json_extract(CASE WHEN json_valid(context) THEN context END, '$.cold')           cold,
           json_extract(CASE WHEN json_valid(context) THEN context END, '$.dict_id')        dict_id,
           json_extract(CASE WHEN json_valid(context) THEN context END, '$.snapshot_bytes') snapshot_bytes
    FROM client_logs
    WHERE received_at >= ? AND message = 'perf' AND ${ctx.audience_filter}
      AND json_extract(CASE WHEN json_valid(context) THEN context END, '$.name') = 'dict_boot'
      AND json_extract(CASE WHEN json_valid(context) THEN context END, '$.duration_ms') > 0
  `).all(ctx.window_start_iso) as { day: string, duration_ms: number, cold: number | null, dict_id: string | null, snapshot_bytes: number | null }[]

  const cold_values: number[] = []
  const warm_values: number[] = []
  const snapshot_sizes: number[] = []
  const by_dict = new Map<string, { cold: number[], warm: number[] }>()
  const by_day = new Map<string, { cold: number[], warm: number[] }>()
  for (const row of rows) {
    const is_cold = row.cold === 1
    ;(is_cold ? cold_values : warm_values).push(row.duration_ms)
    if (is_cold && typeof row.snapshot_bytes === 'number' && row.snapshot_bytes > 0)
      snapshot_sizes.push(row.snapshot_bytes)
    const dict_id = row.dict_id ?? 'unknown'
    if (!by_dict.has(dict_id))
      by_dict.set(dict_id, { cold: [], warm: [] })
    ;(is_cold ? by_dict.get(dict_id)?.cold : by_dict.get(dict_id)?.warm)?.push(row.duration_ms)
    if (!by_day.has(row.day))
      by_day.set(row.day, { cold: [], warm: [] })
    ;(is_cold ? by_day.get(row.day)?.cold : by_day.get(row.day)?.warm)?.push(row.duration_ms)
  }

  const side = (values: number[]): DictBootSide => ({ count: values.length, p50: percentile(values, 50), p90: percentile(values, 90), p95: percentile(values, 95) })

  // Catalog names so the panel reads "Sugt'stun", not an opaque id.
  const dict_ids = [...by_dict.keys()].filter(id => id !== 'unknown')
  const names = new Map<string, { name: string | null, url: string | null }>()
  if (dict_ids.length) {
    const placeholders = dict_ids.map(() => '?').join(', ')
    for (const row of ctx.shared_db.prepare(`SELECT id, name, url FROM dictionaries WHERE id IN (${placeholders})`).all(...dict_ids) as { id: string, name: string | null, url: string | null }[])
      names.set(row.id, { name: row.name, url: row.url })
  }
  const by_dictionary = [...by_dict.entries()]
    .map(([dictionary_id, values]) => ({
      dictionary_id,
      name: names.get(dictionary_id)?.name ?? null,
      url: names.get(dictionary_id)?.url ?? null,
      count: values.cold.length + values.warm.length,
      cold_count: values.cold.length,
      cold_p50: percentile(values.cold, 50),
      warm_p50: percentile(values.warm, 50),
      max: values.cold.length + values.warm.length ? Math.max(...values.cold, ...values.warm) : null,
    }))
    .sort((first, second) => (second.cold_p50 ?? second.warm_p50 ?? 0) - (first.cold_p50 ?? first.warm_p50 ?? 0))
    .slice(0, ROUTE_PERF_LIMIT)

  const daily = [...by_day.entries()]
    .sort(([first_day], [second_day]) => first_day.localeCompare(second_day))
    .map(([day, values]) => ({ day, cold_count: values.cold.length, warm_count: values.warm.length, cold_p50: percentile(values.cold, 50), cold_p95: percentile(values.cold, 95) }))

  return {
    total: rows.length,
    cold: side(cold_values),
    warm: side(warm_values),
    cold_snapshot_bytes_p50: percentile(snapshot_sizes, 50),
    by_dictionary,
    daily,
  }
}

/**
 * Core Web Vitals (hot window). `web_vital` perf rows carry `value` (ms, or
 * unitless for CLS) not `duration_ms`, aggregated separately from the timing mix.
 * p75 is the canonical CWV threshold.
 */
function build_web_vitals(ctx: AnalyticsContext): WebVitalSummary[] {
  const web_vital_rows = ctx.logs_db.prepare(`
    SELECT json_extract(CASE WHEN json_valid(context) THEN context END, '$.metric') metric, json_extract(CASE WHEN json_valid(context) THEN context END, '$.value') value
    FROM client_logs
    WHERE received_at >= ? AND message = 'perf' AND ${ctx.audience_filter}
      AND json_extract(CASE WHEN json_valid(context) THEN context END, '$.name') = 'web_vital'
      AND json_extract(CASE WHEN json_valid(context) THEN context END, '$.value') IS NOT NULL
  `).all(ctx.window_start_iso) as { metric: string | null, value: number }[]
  const web_vital_values = new Map<string, number[]>()
  for (const row of web_vital_rows) {
    if (!row.metric || typeof row.value !== 'number')
      continue
    if (!web_vital_values.has(row.metric))
      web_vital_values.set(row.metric, [])
    web_vital_values.get(row.metric)?.push(row.value)
  }
  const web_vital_names = [...WEB_VITAL_METRICS, ...[...web_vital_values.keys()].filter(name => !WEB_VITAL_METRICS.includes(name as typeof WEB_VITAL_METRICS[number]))]
  return web_vital_names
    .filter(name => web_vital_values.has(name))
    .map((name) => {
      const values = web_vital_values.get(name) ?? []
      return { metric: name, count: values.length, p50: percentile(values, 50), p75: percentile(values, 75), p95: percentile(values, 95) }
    })
}

interface GeoLatencyRow { value: number, country: string | null, latitude: number | null, longitude: number | null }

/** Split a metric's real-user samples into by-country + by-distance-to-Boston latency percentiles. */
function split_geo_latency(rows: GeoLatencyRow[]): { by_country: GeoLatency[], by_distance: GeoLatency[] } {
  const by_country_values = new Map<string, number[]>()
  const by_distance_values = new Map<string, number[]>()
  for (const row of rows) {
    if (typeof row.value !== 'number')
      continue
    if (row.country) {
      if (!by_country_values.has(row.country))
        by_country_values.set(row.country, [])
      by_country_values.get(row.country)?.push(row.value)
    }
    const km = distance_to_origin_km({ latitude: row.latitude, longitude: row.longitude })
    if (km !== null) {
      if (!by_distance_values.has(distance_bucket(km)))
        by_distance_values.set(distance_bucket(km), [])
      by_distance_values.get(distance_bucket(km))?.push(row.value)
    }
  }
  const by_country: GeoLatency[] = [...by_country_values.entries()]
    .map(([label, values]) => ({ label, count: values.length, p50: percentile(values, 50), p95: percentile(values, 95) }))
    .sort((first, second) => second.count - first.count)
    .slice(0, TOP_LIMIT)
  const by_distance: GeoLatency[] = DISTANCE_BUCKETS
    .filter(bucket => by_distance_values.has(bucket))
    .map((bucket) => {
      const values = by_distance_values.get(bucket) ?? []
      return { label: bucket, count: values.length, p50: percentile(values, 50), p95: percentile(values, 95) }
    })
  return { by_country, by_distance }
}

/**
 * Geo-split real-user latency (hot window). TTFB uses the page_load perf row's
 * `responseStart` (context.ttfb) — the distance-sensitive server round-trip; LCP
 * uses the `web_vital` LCP value, whose distance p95 tail is the far-region
 * cold-snapshot path. Both grouped by country + by distance to the Boston origin.
 */
function build_geo_latency(ctx: AnalyticsContext): { ttfb_by_country: GeoLatency[], ttfb_by_distance: GeoLatency[], lcp_by_country: GeoLatency[], lcp_by_distance: GeoLatency[] } {
  const ttfb_rows = ctx.logs_db.prepare(`
    SELECT json_extract(CASE WHEN json_valid(context) THEN context END, '$.ttfb') value, country, latitude, longitude
    FROM client_logs
    WHERE received_at >= ? AND message = 'perf' AND ${ctx.audience_filter}
      AND json_extract(CASE WHEN json_valid(context) THEN context END, '$.name') = 'page_load'
      AND json_extract(CASE WHEN json_valid(context) THEN context END, '$.ttfb') IS NOT NULL
  `).all(ctx.window_start_iso) as GeoLatencyRow[]
  const lcp_rows = ctx.logs_db.prepare(`
    SELECT json_extract(CASE WHEN json_valid(context) THEN context END, '$.value') value, country, latitude, longitude
    FROM client_logs
    WHERE received_at >= ? AND message = 'perf' AND ${ctx.audience_filter}
      AND json_extract(CASE WHEN json_valid(context) THEN context END, '$.name') = 'web_vital'
      AND json_extract(CASE WHEN json_valid(context) THEN context END, '$.metric') = 'LCP'
      AND json_extract(CASE WHEN json_valid(context) THEN context END, '$.value') IS NOT NULL
  `).all(ctx.window_start_iso) as GeoLatencyRow[]

  const ttfb = split_geo_latency(ttfb_rows)
  const lcp = split_geo_latency(lcp_rows)
  return { ttfb_by_country: ttfb.by_country, ttfb_by_distance: ttfb.by_distance, lcp_by_country: lcp.by_country, lcp_by_distance: lcp.by_distance }
}

/**
 * Errors split by build version (hot window only — app_version isn't in the
 * rollup). Live deployed build vs any stale build, so deploy-tail noise on
 * not-yet-refreshed tabs is legible vs real errors.
 */
function build_errors_by_version(ctx: AnalyticsContext): ErrorsByVersion {
  const version_error_rows = ctx.logs_db.prepare(`
    SELECT app_version version, COUNT(*) errors FROM client_logs
    WHERE received_at >= ? AND level IN ${ERROR_LEVELS_SQL}
    GROUP BY app_version
  `).all(ctx.window_start_iso) as { version: string | null, errors: number }[]
  let version_current_errors = 0
  let version_stale_errors = 0
  const error_versions = version_error_rows
    .map((row) => {
      const is_current = ctx.current_app_version != null && row.version === ctx.current_app_version
      if (is_current)
        version_current_errors += row.errors
      else
        version_stale_errors += row.errors
      return { version: row.version, errors: row.errors, is_current }
    })
    .sort((first, second) => second.errors - first.errors)
  const version_total_errors = version_current_errors + version_stale_errors

  // Deploy-tail fold: an error is "settling" if it landed within DEPLOY_TAIL_MINUTES
  // of its build's first appearance in the window. Isolates post-deploy chunk/asset
  // races (even on the current build) from standing regressions.
  const build_first_seen = new Map(
    (ctx.logs_db.prepare(`
      SELECT app_version build, MIN(received_at) first_seen FROM client_logs
      WHERE received_at >= ? AND app_version IS NOT NULL
      GROUP BY app_version
    `).all(ctx.window_start_iso) as { build: string, first_seen: string }[])
      .map(row => [row.build, Date.parse(row.first_seen)] as const),
  )
  const tail_error_rows = ctx.logs_db.prepare(`
    SELECT received_at, app_version build FROM client_logs
    WHERE received_at >= ? AND level IN ${ERROR_LEVELS_SQL} AND app_version IS NOT NULL
  `).all(ctx.window_start_iso) as { received_at: string, build: string }[]
  let deploy_tail_errors = 0
  for (const row of tail_error_rows) {
    const first_seen_ms = build_first_seen.get(row.build)
    if (first_seen_ms != null && Date.parse(row.received_at) - first_seen_ms <= DEPLOY_TAIL_MINUTES * 60_000)
      deploy_tail_errors++
  }

  return {
    current_version: ctx.current_app_version ?? null,
    total: version_total_errors,
    current: version_current_errors,
    stale: version_stale_errors,
    stale_pct: version_total_errors > 0 ? version_stale_errors / version_total_errors : null,
    deploy_tail_errors,
    deploy_tail_pct: version_total_errors > 0 ? deploy_tail_errors / version_total_errors : null,
    versions: error_versions,
  }
}

/**
 * Distinct builds seen in the window (app_version = build epoch ms), first-seen
 * day each, for timeline markers ("which deploy caused this spike?"). Human rows
 * only so it lines up with the (bot-excluded) traffic/error charts.
 */
function build_deploys(ctx: AnalyticsContext): Deploy[] {
  return (ctx.logs_db.prepare(`
    SELECT app_version version, MIN(received_at) first_seen,
           COUNT(DISTINCT session_id) sessions
    FROM client_logs
    WHERE received_at >= ? AND app_version IS NOT NULL AND ${ctx.audience_filter}
    GROUP BY app_version ORDER BY first_seen
  `).all(ctx.window_start_iso) as { version: string, first_seen: string, sessions: number }[])
    .map(row => ({ ...row, day: row.first_seen.slice(0, 10) }))
}

/** Ingestion liveness — broken vs no-traffic at a glance (all-time, not windowed). Recomputed FRESH on every call. */
function build_pipeline_health({ shared_db, logs_db }: { shared_db: Database.Database, logs_db: Database.Database }): PipelineHealth {
  const last_log_at = (logs_db.prepare(`SELECT MAX(received_at) v FROM client_logs`).get() as { v: string | null }).v
  const last_session_start_at = (logs_db.prepare(`SELECT MAX(received_at) v FROM client_logs WHERE message = 'session_start'`).get() as { v: string | null }).v
  const last_server_log_at = (logs_db.prepare(`SELECT MAX(received_at) v FROM client_logs WHERE source = 'server'`).get() as { v: string | null }).v
  const retention_ran_at = (shared_db.prepare(`SELECT value FROM db_metadata WHERE key = 'log_retention_ran_at'`).get() as { value: string } | undefined)?.value ?? null
  const hot_rows = (logs_db.prepare(`SELECT COUNT(*) n FROM client_logs`).get() as { n: number }).n
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

/**
 * Leader-worker DB health: the live_query_* family (hot window). GROUP BY uses an
 * unshadowed `lq_source` alias — a bare `source` alias collides with the real
 * client_logs.source COLUMN and SQLite binds GROUP BY to the COLUMN, which
 * collapsed the admin/viewer/dict split into one arbitrary label (bug fixed
 * 2026-07-05 in the parity port).
 */
function build_leader_health(ctx: AnalyticsContext): LeaderHealth {
  const { logs_db, window_start_iso, current_app_version } = ctx
  const leader_count = (message: string) => (logs_db.prepare(
    `SELECT COUNT(*) n FROM client_logs WHERE received_at >= ? AND message = ?`,
  ).get(window_start_iso, message) as { n: number }).n
  const failed_no_leader = (logs_db.prepare(`
    SELECT COUNT(*) n FROM client_logs
    WHERE received_at >= ? AND message = 'live_query_failed' AND json_extract(CASE WHEN json_valid(context) THEN context END, '$.had_leader') = 0
  `).get(window_start_iso) as { n: number }).n
  const failed_by_source = logs_db.prepare(`
    SELECT coalesce(json_extract(CASE WHEN json_valid(context) THEN context END, '$.source'), 'unknown') lq_source, COUNT(*) count
    FROM client_logs WHERE received_at >= ? AND message = 'live_query_failed'
    GROUP BY lq_source ORDER BY count DESC
  `).all(window_start_iso).map((row: { lq_source: string, count: number }) => ({ source: row.lq_source, count: row.count })) as { source: string, count: number }[]
  const failed_by_code = logs_db.prepare(`
    SELECT coalesce(json_extract(CASE WHEN json_valid(context) THEN context END, '$.code'), 'unknown') code, COUNT(*) count
    FROM client_logs WHERE received_at >= ? AND message = 'live_query_failed'
    GROUP BY code ORDER BY count DESC
  `).all(window_start_iso) as { code: string, count: number }[]
  const failed_current = (logs_db.prepare(`
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

/**
 * A stale-build `client_behind` tab is still "stuck" if it emitted within this
 * window of now — the dict-engine throttle caps repeat storm rows at one per 10
 * min, so 45 min tolerates a throttle gap + a backgrounded-tab heartbeat lull
 * before we stop counting a tab as actively stuck.
 */
const SYNC_STUCK_RECENT_MS = 45 * 60 * 1000

/**
 * Sync health — the `sync_failed` family (hot window). Splits per-kind volume by
 * current vs stale build and isolates the `client_behind` storm class, then
 * derives the distinct (user, dict) tabs STILL stuck on a stale build (a fix
 * can't reach a backgrounded tab that never reloads). See the `SyncHealth` doc.
 */
function build_sync_health(ctx: AnalyticsContext): SyncHealth {
  const { logs_db, window_start_iso, current_app_version, now } = ctx
  const rows = logs_db.prepare(`
    SELECT coalesce(json_extract(CASE WHEN json_valid(context) THEN context END, '$.kind'), 'unknown') kind,
           app_version,
           user_id,
           json_extract(CASE WHEN json_valid(context) THEN context END, '$.dict_id') dict_id,
           received_at
    FROM client_logs
    WHERE received_at >= ? AND message = 'sync_failed'
  `).all(window_start_iso) as { kind: string, app_version: string | null, user_id: string | null, dict_id: string | null, received_at: string }[]

  const is_current = (version: string | null): boolean => current_app_version != null && version === current_app_version
  const kind_counts = new Map<string, { count: number, current: number, stale: number }>()
  const client_behind = { total: 0, current: 0, stale: 0 }
  // (user, dict) tab → aggregate over STALE-build client_behind rows (the residual
  // a deploy can't reach). A current-build client_behind isn't "stuck" — the fix recovers it.
  interface StuckAccum { user_id: string | null, dict_id: string | null, app_version: string | null, count: number, first_seen: string, last_seen: string }
  const stuck_by_tab = new Map<string, StuckAccum>()

  for (const row of rows) {
    const bucket = kind_counts.get(row.kind) ?? { count: 0, current: 0, stale: 0 }
    bucket.count++
    if (is_current(row.app_version))
      bucket.current++
    else
      bucket.stale++
    kind_counts.set(row.kind, bucket)

    if (row.kind === 'client_behind') {
      client_behind.total++
      if (is_current(row.app_version)) {
        client_behind.current++
      } else {
        client_behind.stale++
        const key = `${row.user_id ?? '∅'}|${row.dict_id ?? '∅'}`
        const tab = stuck_by_tab.get(key)
        if (!tab) {
          stuck_by_tab.set(key, { user_id: row.user_id, dict_id: row.dict_id, app_version: row.app_version, count: 1, first_seen: row.received_at, last_seen: row.received_at })
        } else {
          tab.count++
          if (row.received_at < tab.first_seen)
            tab.first_seen = row.received_at
          if (row.received_at > tab.last_seen) {
            tab.last_seen = row.received_at
            tab.app_version = row.app_version
          }
        }
      }
    }
  }

  const recent_cutoff = now.getTime() - SYNC_STUCK_RECENT_MS
  const stuck = [...stuck_by_tab.values()]
    .filter(tab => new Date(tab.last_seen).getTime() >= recent_cutoff)
    .sort((first, second) => second.last_seen.localeCompare(first.last_seen))
  const oldest_unresolved_at = stuck.reduce<string | null>((oldest, tab) => (!oldest || tab.first_seen < oldest ? tab.first_seen : oldest), null)

  const by_kind = [...kind_counts.entries()]
    .map(([kind, value]) => ({ kind, ...value }))
    .sort((first, second) => second.count - first.count)

  return {
    total: rows.length,
    by_kind,
    client_behind,
    stuck_pairs: stuck.length,
    oldest_unresolved_at,
    stuck,
  }
}

/** "Active" for build adoption = a session_start within this many hours of now. */
const BUILD_ADOPTION_ACTIVE_HOURS = 24
/** A non-current build this many days older than the current one counts as stranded. */
const STALE_BUILD_DAYS = 3

/** Parse an `app_version` (build epoch ms) to a number; null for dev/odd builds. */
function build_epoch_ms(app_version: string | null): number | null {
  if (!app_version)
    return null
  const parsed = Number(app_version)
  // Sanity: build epochs are ms timestamps (13 digits, year ≥ 2020).
  return Number.isFinite(parsed) && parsed > 1_577_836_800_000 ? parsed : null
}

/**
 * Build adoption (see `BuildAdoption` doc): last-24h `session_start` rows grouped
 * by `app_version`, the build epoch decoded to an age bucket relative to the
 * current build. Signed-in users per stale build are named so "who to nudge" is
 * one glance, not a hand query.
 */
function build_build_adoption(ctx: AnalyticsContext): BuildAdoption {
  const { logs_db, current_app_version, now } = ctx
  const active_start_iso = new Date(Math.max(now.getTime() - BUILD_ADOPTION_ACTIVE_HOURS * 3600_000, Date.parse(ctx.window_start_iso))).toISOString()
  const rows = logs_db.prepare(`
    SELECT app_version, COUNT(DISTINCT session_id) sessions, MAX(received_at) last_seen
    FROM client_logs
    WHERE received_at >= ? AND message = 'session_start' AND app_version IS NOT NULL AND ${ctx.audience_filter}
    GROUP BY app_version
  `).all(active_start_iso) as { app_version: string, sessions: number, last_seen: string }[]
  // Signed-in users per build — from ANY row (login often happens after session_start).
  const user_rows = logs_db.prepare(`
    SELECT DISTINCT app_version, user_id
    FROM client_logs
    WHERE received_at >= ? AND user_id IS NOT NULL AND app_version IS NOT NULL AND ${ctx.audience_filter}
  `).all(active_start_iso) as { app_version: string, user_id: string }[]
  const users_by_build = new Map<string, string[]>()
  for (const row of user_rows) {
    const list = users_by_build.get(row.app_version) ?? []
    list.push(row.user_id)
    users_by_build.set(row.app_version, list)
  }

  // Age is measured against the current build's epoch (falling back to now when
  // the deployed version isn't a parseable epoch, e.g. dev).
  const reference_ms = build_epoch_ms(current_app_version) ?? now.getTime()
  let current = 0
  let behind = 0
  let stale = 0
  let unknown = 0
  const builds = rows.map((row) => {
    const is_current = current_app_version != null && row.app_version === current_app_version
    const epoch = build_epoch_ms(row.app_version)
    const age_days = epoch != null ? Math.max(0, Math.round(((reference_ms - epoch) / 86_400_000) * 10) / 10) : null
    if (is_current)
      current += row.sessions
    else if (age_days == null)
      unknown += row.sessions
    else if (age_days >= STALE_BUILD_DAYS)
      stale += row.sessions
    else
      behind += row.sessions
    return { app_version: row.app_version, age_days, sessions: row.sessions, users: (users_by_build.get(row.app_version) ?? []).sort(), last_seen: row.last_seen, is_current }
  }).sort((first, second) => ((second.age_days ?? -1) - (first.age_days ?? -1)) || (second.sessions - first.sessions)) // oldest (most stranded) first

  const judgeable = current + behind + stale
  return {
    total: current + behind + stale + unknown,
    current,
    behind,
    stale,
    unknown,
    stranded_pct: judgeable > 0 ? (behind + stale) / judgeable : null,
    builds,
  }
}

/** `statSync` size; null when the path doesn't exist (`:memory:` handles, missing WAL). */
function file_bytes(path: string): number | null {
  try {
    return statSync(path).size
  } catch {
    return null
  }
}

/**
 * Live storage / WAL health (see `StorageHealth`): `statSync` over the central DB
 * files' paths (taken from the open handles) + an aggregate over
 * `dictionaries/*.db`. Ported from the house/tutor strip.
 */
function build_storage({ shared_db, logs_db }: { shared_db: Database.Database, logs_db: Database.Database }): StorageHealth {
  const targets = [
    { path: shared_db.name, name: 'shared.db' },
    { path: logs_db.name, name: 'logs.db' },
  ]
  try {
    targets.push({ path: get_log_archive_db().name, name: 'logs-archive.db' })
  } catch {
    // archive DB unavailable (tests) — skip the row
  }
  const seen_paths = new Set<string>()
  const dbs: StorageDb[] = []
  for (const target of targets) {
    if (seen_paths.has(target.path))
      continue // tests pass one handle for both shared + logs
    seen_paths.add(target.path)
    const db_bytes = file_bytes(target.path)
    if (db_bytes === null)
      continue
    const wal_bytes = file_bytes(`${target.path}-wal`) ?? 0
    dbs.push({ name: target.name, db_bytes, wal_bytes, wal_ratio: db_bytes > 0 ? wal_bytes / db_bytes : null })
  }

  let dict_dbs: StorageHealth['dict_dbs'] = null // stays null when the dictionaries dir is absent (tests / fresh dev)
  try {
    const dictionaries_dir = join(process.env.DATA_DIR || '.data', 'dictionaries')
    const db_files = readdirSync(dictionaries_dir).filter(file => file.endsWith('.db'))
    let db_bytes = 0
    let wal_bytes = 0
    for (const file of db_files) {
      db_bytes += file_bytes(join(dictionaries_dir, file)) ?? 0
      wal_bytes += file_bytes(join(dictionaries_dir, `${file}-wal`)) ?? 0
    }
    dict_dbs = { count: db_files.length, db_bytes, wal_bytes }
  } catch {
    // dictionaries dir unreadable — leave dict_dbs null
  }
  return { dbs, dict_dbs }
}

/**
 * Agent/API write activity — the server-emitted `v1_*` events (one row per
 * `/api/v1` operation). Hot window only: v1 rows aren't in the daily rollup.
 */
function build_api_v1_activity(ctx: AnalyticsContext): ApiV1Activity {
  const rows = ctx.logs_db.prepare(`
    SELECT substr(received_at, 1, 10) day,
           message event,
           CASE WHEN level IN ${ERROR_LEVELS_SQL} THEN 1 ELSE 0 END is_failure,
           json_extract(CASE WHEN json_valid(context) THEN context END, '$.dictionary_id') dictionary_id,
           json_extract(CASE WHEN json_valid(context) THEN context END, '$.via') via,
           COUNT(*) count
    FROM client_logs
    WHERE received_at >= ? AND source = 'server' AND message LIKE 'v1\\_%' ESCAPE '\\'
    GROUP BY day, event, is_failure, dictionary_id, via
  `).all(ctx.window_start_iso) as { day: string, event: string, is_failure: 0 | 1, dictionary_id: string | null, via: string | null, count: number }[]

  let total = 0
  let failures = 0
  const daily = new Map<string, { day: string, count: number, failures: number }>()
  const by_event = new Map<string, number>()
  const by_dictionary = new Map<string, number>()
  const by_via = new Map<string, number>()
  for (const row of rows) {
    total += row.count
    if (row.is_failure)
      failures += row.count
    let day_point = daily.get(row.day)
    if (!day_point) {
      day_point = { day: row.day, count: 0, failures: 0 }
      daily.set(row.day, day_point)
    }
    day_point.count += row.count
    if (row.is_failure)
      day_point.failures += row.count
    bump(by_event, row.event, row.count)
    bump(by_dictionary, row.dictionary_id ?? 'unknown', row.count)
    bump(by_via, row.via ?? 'unknown', row.count)
  }

  const desc = (map: Map<string, number>) => [...map.entries()].sort((a, b) => b[1] - a[1])
  return {
    total,
    failures,
    daily: [...daily.values()].sort((a, b) => a.day.localeCompare(b.day)),
    by_event: desc(by_event).map(([event, count]) => ({ event, count })),
    by_dictionary: desc(by_dictionary).map(([dictionary_id, count]) => ({ dictionary_id, count })),
    by_via: desc(by_via).map(([via, count]) => ({ via, count })),
  }
}

/**
 * Entry edits by channel (see the `EntryEditChannels` doc). Zero-filled ascending
 * daily series over the full window: finalized days from the rollup
 * (`event:entry_created`/`event:entry_deleted` for UI, the bulk-weighted
 * `api_entry_edits` metric for API), live-tail days from raw rows — live wins
 * per day, same contract as `build_daily_series`.
 */
function build_entry_edit_channels({ ctx, rollup_rows, live_by_day }: {
  ctx: AnalyticsContext
  rollup_rows: RollupRow[]
  live_by_day: Map<string, DailyPoint>
}): EntryEditChannels {
  const { logs_db, audience_filter, rollup_metric, live_start_iso } = ctx

  const ui_by_day = new Map<string, number>()
  const api_by_day = new Map<string, number>()

  // Rollup days pre-dating the `api_entry_edits` metric (shipped 2026-07-18):
  // collect their `event:v1_*` row counts as a fallback (undercounts bulk writes).
  const has_api_metric = new Set<string>()
  const legacy_api_by_day = new Map<string, number>()
  for (const row of rollup_rows) {
    if (live_by_day.has(row.day))
      continue // live wins for this day
    const metric = rollup_metric(row.metric)
    if (metric === null)
      continue // wrong audience namespace
    if (metric === `event:${ENTRY_CREATED}` || metric === `event:${ENTRY_DELETED}`) {
      bump(ui_by_day, row.day, row.value)
    } else if (metric === 'api_entry_edits') {
      has_api_metric.add(row.day)
      bump(api_by_day, row.day, row.value)
    } else if (metric === 'event:v1_entries_written' || metric === 'event:v1_entry_updated' || metric === 'event:v1_entry_deleted') {
      bump(legacy_api_by_day, row.day, row.value)
    }
  }
  for (const [day, value] of legacy_api_by_day) {
    if (!has_api_metric.has(day))
      bump(api_by_day, day, value)
  }

  // Live tail — UI analytics events (client rows, audience-filtered like every usage panel).
  for (const row of logs_db.prepare(`
    SELECT substr(received_at, 1, 10) day, COUNT(*) count FROM client_logs
    WHERE received_at >= ? AND level = 'info' AND message IN (?, ?) AND ${audience_filter}
    GROUP BY day
  `).all(live_start_iso, ENTRY_CREATED, ENTRY_DELETED) as { day: string, count: number }[])
    bump(ui_by_day, row.day, row.count)

  // Live tail — v1 entry writes (server rows are never bots), bulk-weighted.
  for (const row of logs_db.prepare(`
    SELECT substr(received_at, 1, 10) day,
           SUM(CASE WHEN message = 'v1_entries_written'
                THEN coalesce(json_extract(CASE WHEN json_valid(context) THEN context END, '$.created'), 0)
                   + coalesce(json_extract(CASE WHEN json_valid(context) THEN context END, '$.updated'), 0)
                ELSE 1 END) count
    FROM client_logs
    WHERE received_at >= ? AND source = 'server' AND level = 'info'
      AND message IN ('v1_entries_written', 'v1_entry_updated', 'v1_entry_deleted')
    GROUP BY day
  `).all(live_start_iso) as { day: string, count: number }[])
    bump(api_by_day, row.day, row.count)

  let ui_total = 0
  let api_total = 0
  const daily: EntryEditChannels['daily'] = zero_fill_days(ctx).map((day) => {
    const ui = ui_by_day.get(day) ?? 0
    const api = api_by_day.get(day) ?? 0
    ui_total += ui
    api_total += api
    return { day, ui, api }
  })
  return { ui_total, api_total, daily }
}

interface DictTotals { visitors_30d: number, anon_visitors_30d: number, visitors_prev_month: number, visitors_7d: number, visits_30d: number }
function empty_dict_totals(): DictTotals {
  return { visitors_30d: 0, anon_visitors_30d: 0, visitors_prev_month: 0, visitors_7d: 0, visits_30d: 0 }
}

/**
 * Per-dictionary viewership by TRUE UNIQUE VISITORS. `visitors_30d` unions raw
 * visitor IDs across hot + archive storage, so a returning browser counts once
 * across the whole rolling window. The previous complete month comes from the
 * forever `dictionary_monthly_visitors` rollup. `visitors_7d` is a live hot-log
 * scan; `visits_30d` merges daily rollups + the live tail for activity context.
 * Names/URLs join the shared.db dictionary catalog.
 */
function build_top_dictionaries(ctx: AnalyticsContext): TopDictionaries {
  const { shared_db, logs_db, archive_db, audience, audience_filter, window_start_iso, window_start_day, live_start_day, live_start_iso, now, bot_session_ids, window_sessions } = ctx
  const month = month_string(now)
  const previous_month = prev_month(month)
  const iso_7d_start = new Date(now.getTime() - 6 * 86_400_000).toISOString()

  const totals_by_dict = new Map<string, DictTotals>()
  const totals_for = (dictionary_id: string): DictTotals => {
    let totals = totals_by_dict.get(dictionary_id)
    if (!totals) {
      totals = empty_dict_totals()
      totals_by_dict.set(dictionary_id, totals)
    }
    return totals
  }
  let site_visitors_prev_month = 0

  // --- Rolling 30d TRUE uniques across BOTH raw-log files. Sets union visitors
  // across files, sessions, and days. Anonymity follows the whole-session flag.
  // Raw rows are retained for 60d, so this remains exact after hot→archive moves. ---
  interface VisitorRow { dictionary_id?: string, session_id: string, visitor_id: string | null, user_agent: string | null }
  interface VisitorSets { visitors: Set<string>, anon_visitors: Set<string> }
  const visitor_sets_by_dict = new Map<string, VisitorSets>()
  const site_visitor_sets: VisitorSets = { visitors: new Set(), anon_visitors: new Set() }
  const session_has_user = new Map(window_sessions.map(session => [session.session_id, session.has_user_id]))
  const is_selected_audience = (row: VisitorRow): boolean => {
    const is_bot = is_bot_user_agent(row.user_agent) || bot_session_ids.has(row.session_id)
    return audience === 'bots' ? is_bot : !is_bot
  }
  const add_visitor = (sets: VisitorSets, row: VisitorRow): void => {
    if (!is_selected_audience(row))
      return
    const visitor_key = row.visitor_id ?? row.session_id
    sets.visitors.add(visitor_key)
    if (!session_has_user.get(row.session_id))
      sets.anon_visitors.add(visitor_key)
  }
  for (const raw_db of [...(archive_db ? [archive_db] : []), logs_db]) {
    for (const row of raw_db.prepare(`
      SELECT json_extract(CASE WHEN json_valid(context) THEN context END, '$.dictionary_id') dictionary_id,
             session_id, visitor_id, user_agent
      FROM client_logs
      WHERE received_at >= ? AND message = ? AND session_id IS NOT NULL
        AND json_extract(CASE WHEN json_valid(context) THEN context END, '$.dictionary_id') IS NOT NULL
    `).all(window_start_iso, DICTIONARY_OPENED) as VisitorRow[]) {
      if (!is_selected_audience(row))
        continue
      let sets = visitor_sets_by_dict.get(row.dictionary_id as string)
      if (!sets) {
        sets = { visitors: new Set(), anon_visitors: new Set() }
        visitor_sets_by_dict.set(row.dictionary_id as string, sets)
      }
      add_visitor(sets, row)
    }
    for (const row of raw_db.prepare(`
      SELECT session_id, visitor_id, user_agent
      FROM client_logs
      WHERE received_at >= ? AND message = ? AND session_id IS NOT NULL
    `).all(window_start_iso, SESSION_START) as VisitorRow[])
      add_visitor(site_visitor_sets, row)
  }
  for (const [dictionary_id, sets] of visitor_sets_by_dict) {
    const totals = totals_for(dictionary_id)
    totals.visitors_30d = sets.visitors.size
    totals.anon_visitors_30d = sets.anon_visitors.size
  }
  const site_visitors_30d = site_visitor_sets.visitors.size

  // --- Previous complete month's TRUE uniques (human-only forever rollup). ---
  if (audience === 'humans') {
    try {
      for (const row of shared_db.prepare(`
        SELECT scope, visitors
        FROM dictionary_monthly_visitors WHERE month = ?
      `).all(previous_month) as { scope: string, visitors: number }[]) {
        if (row.scope === SITE_SCOPE) {
          site_visitors_prev_month = row.visitors
          continue
        }
        const totals = totals_by_dict.get(row.scope)
        if (totals)
          totals.visitors_prev_month = row.visitors
      }
    } catch {
      // Table absent (never migrated) — previous-month figures stay 0.
    }
  }

  // --- Rolling 7d TRUE uniques, live from hot logs (audience-filtered). Per-dict +
  // site (session_start = anyone who visited). ---
  for (const row of logs_db.prepare(`
    SELECT json_extract(CASE WHEN json_valid(context) THEN context END, '$.dictionary_id')          dictionary_id,
           COUNT(DISTINCT COALESCE(visitor_id, session_id))  visitors
    FROM client_logs
    WHERE received_at >= ? AND message = ? AND session_id IS NOT NULL
      AND json_extract(CASE WHEN json_valid(context) THEN context END, '$.dictionary_id') IS NOT NULL AND ${audience_filter}
    GROUP BY dictionary_id
  `).all(iso_7d_start, DICTIONARY_OPENED) as { dictionary_id: string, visitors: number }[])
    totals_for(row.dictionary_id).visitors_7d = row.visitors
  const site_visitors_7d = (logs_db.prepare(`
    SELECT COUNT(DISTINCT COALESCE(visitor_id, session_id)) visitors
    FROM client_logs
    WHERE received_at >= ? AND message = ? AND session_id IS NOT NULL AND ${audience_filter}
  `).get(iso_7d_start, SESSION_START) as { visitors: number }).visitors

  // --- Visits (sessions) over 30d, daily rollup + live tail, for activity context. ---
  const visits_by_dict = new Map<string, number>()
  const bump_visits = (dictionary_id: string, count: number): void => {
    visits_by_dict.set(dictionary_id, (visits_by_dict.get(dictionary_id) ?? 0) + count)
  }
  if (audience === 'humans') {
    try {
      for (const row of shared_db.prepare(`
        SELECT dictionary_id, SUM(sessions) sessions FROM dictionary_daily_views
        WHERE day >= ? AND day < ? GROUP BY dictionary_id
      `).all(window_start_day, live_start_day) as { dictionary_id: string, sessions: number }[])
        bump_visits(row.dictionary_id, row.sessions)
    } catch { /* table absent */ }
  }
  for (const row of logs_db.prepare(`
    SELECT json_extract(CASE WHEN json_valid(context) THEN context END, '$.dictionary_id') dictionary_id, COUNT(DISTINCT session_id) sessions
    FROM client_logs
    WHERE received_at >= ? AND message = ? AND session_id IS NOT NULL
      AND json_extract(CASE WHEN json_valid(context) THEN context END, '$.dictionary_id') IS NOT NULL AND ${audience_filter}
    GROUP BY dictionary_id
  `).all(live_start_iso, DICTIONARY_OPENED) as { dictionary_id: string, sessions: number }[])
    bump_visits(row.dictionary_id, row.sessions)
  for (const [dictionary_id, sessions] of visits_by_dict)
    totals_for(dictionary_id).visits_30d = sessions

  // Catalog names/urls for the dicts in play (one IN query).
  const ids = [...totals_by_dict.keys()]
  const catalog = new Map<string, { name: string | null, url: string | null, is_public: boolean }>()
  if (ids.length) {
    const placeholders = ids.map(() => '?').join(', ')
    for (const row of shared_db.prepare(`
      SELECT id, name, url, public FROM dictionaries WHERE id IN (${placeholders})
    `).all(...ids) as { id: string, name: string | null, url: string | null, public: number | null }[])
      catalog.set(row.id, { name: row.name, url: row.url, is_public: row.public === 1 })
  }

  const dictionaries: TopDictionaryRow[] = [...totals_by_dict.entries()]
    .map(([dictionary_id, totals]) => {
      const meta = catalog.get(dictionary_id)
      return {
        dictionary_id,
        name: meta?.name ?? null,
        url: meta?.url ?? null,
        is_public: meta?.is_public ?? false,
        ...totals,
      }
    })
    .sort((first, second) =>
      second.visitors_30d - first.visitors_30d
      || second.visitors_prev_month - first.visitors_prev_month
      || second.visitors_7d - first.visitors_7d
      || second.visits_30d - first.visits_30d)
    .slice(0, TOP_DICTIONARIES_LIMIT)

  return {
    distinct_dictionaries: [...totals_by_dict.values()].filter(totals => totals.visitors_30d > 0).length,
    prev_month: previous_month,
    site_visitors_30d,
    site_visitors_prev_month,
    site_visitors_7d,
    dictionaries,
  }
}
