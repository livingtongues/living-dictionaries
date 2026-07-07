import type { LogAnalytics } from '$lib/db/server/log-analytics'

/**
 * Story fixtures for the two admin telemetry dashboards — `/admin/analytics` (usage)
 * and `/admin/health` (diagnostics). Both pages consume the same server-computed
 * `LogAnalytics`, so the mock lives here and is shared by both `_page.stories.ts`.
 */

function build_daily(days: number): LogAnalytics['daily'] {
  const end = new Date('2026-06-23T00:00:00.000Z')
  const out: LogAnalytics['daily'] = []
  for (let offset = days - 1; offset >= 0; offset--) {
    const day = new Date(end.getTime() - offset * 86_400_000).toISOString().slice(0, 10)
    // A rising trend with a couple of error spikes + a quiet stretch.
    const base = Math.round(40 + (days - offset) * 6 + Math.sin(offset) * 25)
    const logs = Math.max(0, base)
    const errors = offset === 4 ? 14 : offset === 11 ? 6 : offset % 7 === 0 ? 2 : 0
    // The offset===4 spike is mostly deploy-day stale-chunk noise (only 3 real
    // faults, 10 of them from stale builds) — exercises both the real-vs-noise
    // split and the stale-build deploy-day overlay on the errors line.
    const real_errors = offset === 4 ? 3 : errors
    const stale_errors = offset === 4 ? 10 : 0
    out.push({
      day,
      logs,
      errors,
      real_errors,
      stale_errors,
      sessions: Math.round(logs / 12),
      users: Math.round(logs / 20),
    })
  }
  return out
}

function build_perf(days: number): LogAnalytics['performance'] {
  const end = new Date('2026-06-23T00:00:00.000Z')
  const daily: LogAnalytics['performance']['daily'] = []
  for (let offset = days - 1; offset >= 0; offset--) {
    const day = new Date(end.getTime() - offset * 86_400_000).toISOString().slice(0, 10)
    const wobble = Math.sin(offset / 2) * 250
    daily.push({
      day,
      metrics: {
        page_load: { p50: Math.round(1100 + wobble), p95: Math.round(4200 + wobble * 2), count: 40 + (offset % 9) },
        navigation: { p50: Math.round(340 + wobble * 0.4), p95: Math.round(1400 + wobble), count: 120 + (offset % 11) },
        viewer_boot: { p50: Math.round(1200 + wobble * 1.5), p95: Math.round(6400 + wobble * 3), count: 6 + (offset % 4) },
      },
    })
  }
  return {
    summary: [
      { name: 'page_load', count: 1240, p50: 1197, p90: 3344, p95: 4537, max: 14652, slowest: { duration_ms: 14652, route: '/example-dict/entries' } },
      { name: 'navigation', count: 3620, p50: 312, p90: 980, p95: 1640, max: 9210, slowest: { duration_ms: 9210, route: '/example-dict/entry/abc' } },
      { name: 'viewer_boot', count: 188, p50: 1184, p90: 4688, p95: 6493, max: 7687, slowest: { duration_ms: 7687, route: '/example-dict' } },
      { name: 'search', count: 0, p50: null, p90: null, p95: null, max: null, slowest: null },
    ],
    daily,
    by_route: [
      { route: 'dictionary:entry', count: 612, p50: 1340, p95: 5210, max: 14652 },
      { route: 'dictionary:entries', count: 388, p50: 1180, p95: 4120, max: 9870 },
      { route: 'home', count: 142, p50: 980, p95: 3010, max: 6200 },
      { route: 'about', count: 64, p50: 420, p95: 1180, max: 2200 },
      { route: 'account', count: 34, p50: 510, p95: 1620, max: 3100 },
    ],
    // Client SPA nav timing by destination — the home→entry path leads by volume.
    nav_by_route: [
      { route: 'dictionary:entry', count: 1820, p50: 388, p95: 1720, max: 9210 },
      { route: 'dictionary:entries', count: 940, p50: 296, p95: 1240, max: 5100 },
      { route: 'home', count: 512, p50: 210, p95: 640, max: 2200 },
      { route: 'dictionary:settings', count: 188, p50: 340, p95: 980, max: 3100 },
      { route: 'account', count: 96, p50: 180, p95: 520, max: 1400 },
    ],
    lcp_by_route: [
      { route: 'dictionary:entry', count: 168, p50: 1720, p95: 4980, max: 9800 },
      { route: 'dictionary:entries', count: 92, p50: 1480, p95: 3810, max: 8200 },
      { route: 'home', count: 56, p50: 1120, p95: 2610, max: 5200 },
    ],
  }
}

function build_uptime(): LogAnalytics['uptime'] {
  const end = new Date('2026-06-23T00:00:00.000Z')
  const daily: LogAnalytics['uptime']['daily'] = []
  for (let offset = 13; offset >= 0; offset--) {
    const day = new Date(end.getTime() - offset * 86_400_000).toISOString().slice(0, 10)
    const wobble = Math.sin(offset / 3) * 40
    daily.push({
      day,
      probes: 288,
      up: offset === 6 ? 285 : 288,
      ttfb_p50: Math.round(120 + wobble),
      ttfb_p95: Math.round(380 + wobble * 2),
    })
  }
  return {
    probes: 4032,
    availability: 0.9993,
    ttfb: { p50: 118, p95: 402 },
    total: { p50: 214, p95: 690 },
    vantages: ['mustang-my'],
    daily,
  }
}

export const mock_analytics: LogAnalytics = {
  audience: 'humans',
  window_days: 30,
  generated_at: '2026-06-23T13:04:00.000Z',
  daily: build_daily(30),
  // A realistic deploy burst — two spread + six across the last two days — so the
  // clustered rail (vs the old pileup) is exercised on the page.
  deploys: [
    { day: '2026-06-12', version: '1782010000000', first_seen: '2026-06-12T09:14:00.000Z', sessions: 70 },
    { day: '2026-06-19', version: '1782090000000', first_seen: '2026-06-19T14:31:00.000Z', sessions: 95 },
    { day: '2026-06-22', version: '1782180000000', first_seen: '2026-06-22T01:18:00.000Z', sessions: 40 },
    { day: '2026-06-22', version: '1782182000000', first_seen: '2026-06-22T02:51:00.000Z', sessions: 38 },
    { day: '2026-06-22', version: '1782184000000', first_seen: '2026-06-22T03:44:00.000Z', sessions: 30 },
    { day: '2026-06-23', version: '1782270000000', first_seen: '2026-06-23T05:45:00.000Z', sessions: 25 },
    { day: '2026-06-23', version: '1782290000000', first_seen: '2026-06-23T08:55:00.000Z', sessions: 20 },
    { day: '2026-06-23', version: '1782300000000', first_seen: '2026-06-23T11:20:00.000Z', sessions: 18 },
  ],
  performance: build_perf(30),
  // Mirrors the production screenshot: LCP/INP/CLS green, FCP/TTFB amber.
  web_vitals: [
    { metric: 'LCP', count: 316, p50: 984, p75: 2100, p95: 8800 },
    { metric: 'INP', count: 216, p50: 48, p75: 88, p95: 248 },
    { metric: 'CLS', count: 218, p50: 0.001, p75: 0.012, p95: 0.262 },
    { metric: 'FCP', count: 406, p50: 852, p75: 1840, p95: 4200 },
    { metric: 'TTFB', count: 561, p50: 451, p75: 860, p95: 2300 },
  ],
  totals: { sessions: 188, errors: 24, real_errors: 13, stale_errors: 10, logs: 2417, unique_users: 73 },
  top_routes: [
    { route: 'search', count: 642, sessions: 88 },
    { route: 'home', count: 511, sessions: 74 },
    { route: 'reader:chapter', count: 388, sessions: 52 },
    { route: 'reader:doc', count: 214, sessions: 39 },
    { route: 'reader:image', count: 142, sessions: 21 },
    { route: 'account', count: 96, sessions: 17 },
    { route: 'reader:video', count: 61, sessions: 9 },
    { route: 'dr-house', count: 33, sessions: 4 },
  ],
  top_events: [
    { event: 'entry_opened', count: 932 },
    { event: 'search_performed', count: 421 },
    { event: 'dictionary_opened', count: 188 },
    { event: 'audio_played', count: 64 },
  ],
  by_source: [
    { source: 'client', logs: 2298, errors: 19 },
    { source: 'server', logs: 119, errors: 5 },
  ],
  error_clusters: [
    { message: 'Cannot read properties of undefined (reading \'split\')', stack_head: 'at parseQuery (search.ts:42)', level: 'error', count: 18, users: 3, first_seen: '2026-06-23T08:10:00.000Z', last_seen: '2026-06-23T11:58:02.000Z', sources: 'client', platforms: 'web', is_noise: false },
    { message: 'entry_save_failed: conflict', stack_head: '', level: 'error', count: 9, users: 2, first_seen: '2026-06-22T20:00:00.000Z', last_seen: '2026-06-23T10:41:15.000Z', sources: 'server', platforms: 'web', is_noise: false },
    { message: '[post_request] Network error for /api/log', stack_head: '', level: 'error', count: 47, users: 1, first_seen: '2026-06-22T19:00:00.000Z', last_seen: '2026-06-23T09:12:44.000Z', sources: 'client', platforms: 'web', is_noise: true },
  ],
  capability: {
    total_sessions: 177,
    below_capability_sessions: 3,
    bot_sessions: 105,
    webdriver_sessions: 14,
    devices: [
      { device: 'desktop', sessions: 103 },
      { device: 'mobile', sessions: 60 },
      { device: 'tablet', sessions: 14 },
    ],
    os: [
      { os: 'Windows', sessions: 71, versions: [{ version: '10/11', sessions: 71 }] },
      { os: 'Android', sessions: 39, versions: [{ version: '14', sessions: 21 }, { version: '13', sessions: 12 }, { version: '12', sessions: 6 }] },
      { os: 'macOS', sessions: 32, versions: [{ version: '10.15', sessions: 32 }] },
      { os: 'iOS', sessions: 21, versions: [{ version: '18', sessions: 13 }, { version: '17', sessions: 8 }] },
      { os: 'Linux', sessions: 9, versions: [{ version: 'unknown', sessions: 9 }] },
      { os: 'ChromeOS', sessions: 5, versions: [{ version: 'unknown', sessions: 5 }] },
    ],
    browsers: [
      { browser: 'Chrome', sessions: 110 },
      { browser: 'Safari', sessions: 41 },
      { browser: 'Edge', sessions: 15 },
      { browser: 'Firefox', sessions: 8 },
      { browser: 'Samsung Internet', sessions: 3 },
    ],
    db_tiers: [
      { tier: 'opfs-worker', sessions: 168 },
      { tier: 'idb-main', sessions: 6 },
    ],
  },
  geo: {
    located_sessions: 174,
    areas: [
      { key: 'US-CA', country: 'US', sessions: 41 },
      { key: 'US-NY', country: 'US', sessions: 28 },
      { key: 'US-TX', country: 'US', sessions: 19 },
      { key: 'US-MA', country: 'US', sessions: 17 },
      { key: 'GB-ENG', country: 'GB', sessions: 14 },
      { key: 'US-FL', country: 'US', sessions: 11 },
      { key: 'CA-ON', country: 'CA', sessions: 9 },
      { key: 'AU-NSW', country: 'AU', sessions: 6 },
    ],
    // Latency rises with distance from the Boston origin.
    ttfb_by_country: [
      { label: 'US', count: 612, p50: 118, p95: 402 },
      { label: 'GB', count: 88, p50: 173, p95: 511 },
      { label: 'CA', count: 41, p50: 96, p95: 318 },
      { label: 'AU', count: 22, p50: 287, p95: 690 },
    ],
    ttfb_by_distance: [
      { label: '< 500 km', count: 196, p50: 71, p95: 214 },
      { label: '500–2,000 km', count: 264, p50: 109, p95: 356 },
      { label: '2,000–5,000 km', count: 188, p50: 158, p95: 489 },
      { label: '5,000–10,000 km', count: 92, p50: 214, p95: 612 },
      { label: '> 10,000 km', count: 35, p50: 301, p95: 742 },
    ],
    lcp_by_country: [
      { label: 'US', count: 588, p50: 1620, p95: 3210 },
      { label: 'GB', count: 82, p50: 2140, p95: 4980 },
      { label: 'AU', count: 20, p50: 3120, p95: 9800 },
    ],
    // The far-region cold-snapshot p95 tail LD6 exists to surface.
    lcp_by_distance: [
      { label: '< 500 km', count: 190, p50: 1180, p95: 2410 },
      { label: '500–2,000 km', count: 255, p50: 1520, p95: 3380 },
      { label: '2,000–5,000 km', count: 180, p50: 2010, p95: 5220 },
      { label: '5,000–10,000 km', count: 88, p50: 2860, p95: 9100 },
      { label: '> 10,000 km', count: 33, p50: 3980, p95: 13350 },
    ],
  },
  errors_by_version: {
    current_version: '1719300000123',
    total: 24,
    current: 4,
    stale: 20,
    stale_pct: 20 / 24,
    deploy_tail_errors: 3,
    deploy_tail_pct: 3 / 24,
    versions: [
      { version: '1719200000111', errors: 20, is_current: false },
      { version: '1719300000123', errors: 4, is_current: true },
    ],
  },
  pipeline: {
    last_log_at: new Date(Date.now() - 3 * 60_000).toISOString(),
    last_session_start_at: new Date(Date.now() - 9 * 60_000).toISOString(),
    last_server_log_at: new Date(Date.now() - 14 * 60_000).toISOString(),
    retention_ran_at: new Date(Date.now() - 5 * 3600_000).toISOString(),
    hot_rows: 2417,
    archived_rows: 18342,
    missing_syncable_tables: [],
  },
  server_faults: {
    total: 9,
    schema_drift_count: 3,
    clusters: [
      { route: '/api/dictionaries/create', message: 'dictionary_create_failed', count: 4, first_seen: new Date(Date.now() - 20 * 3600_000).toISOString(), last_seen: new Date(Date.now() - 40 * 60_000).toISOString(), statuses: '500', is_schema_drift: false },
      { route: '/[dictionaryId]/entries', message: 'admin_sync_failed', count: 3, first_seen: new Date(Date.now() - 6 * 3600_000).toISOString(), last_seen: new Date(Date.now() - 12 * 60_000).toISOString(), statuses: '500', is_schema_drift: true },
      { route: null, message: 'gcs_serving_url_failed', count: 2, first_seen: new Date(Date.now() - 3 * 3600_000).toISOString(), last_seen: new Date(Date.now() - 90 * 60_000).toISOString(), statuses: null, is_schema_drift: false },
    ],
  },
  event_coverage: {
    events: [
      { event: 'search_performed', seen: true, count: 421 },
      { event: 'dictionary_opened', seen: true, count: 188 },
      { event: 'entry_opened', seen: true, count: 932 },
      { event: 'audio_played', seen: false, count: 0 },
    ],
    never_emitted: 1,
  },
  leader_health: {
    timeouts: 12,
    recovered: 11,
    failed: 3,
    failed_no_leader: 1,
    failed_by_source: [{ source: 'viewer', count: 2 }, { source: 'dict', count: 1 }],
    failed_by_code: [{ code: 'NOTADB', count: 2 }, { code: 'timeout', count: 1 }],
    failed_current: 1,
    failed_stale: 2,
  },
  // The client_behind storm post-fix: zero on the current build, a residual of a
  // few stale-build tabs (incl. an admin's own) still stuck until they reload.
  sync_health: {
    total: 8260,
    by_kind: [
      { kind: 'client_behind', count: 8170, current: 0, stale: 8170 },
      { kind: 'snapshot_expired', count: 60, current: 12, stale: 48 },
      { kind: 'network', count: 27, current: 20, stale: 7 },
      { kind: 'storage_lost', count: 3, current: 3, stale: 0 },
    ],
    client_behind: { total: 8170, current: 0, stale: 8170 },
    stuck_pairs: 3,
    oldest_unresolved_at: new Date(Date.now() - 36 * 3600_000).toISOString(),
    stuck: [
      { user_id: 'greg', dict_id: 'apatani', app_version: '1783096241136', count: 2405, first_seen: new Date(Date.now() - 36 * 3600_000).toISOString(), last_seen: new Date(Date.now() - 4 * 60_000).toISOString() },
      { user_id: null, dict_id: 'river', app_version: '1783053248757', count: 1746, first_seen: new Date(Date.now() - 30 * 3600_000).toISOString(), last_seen: new Date(Date.now() - 9 * 60_000).toISOString() },
      { user_id: 'marlene', dict_id: 'zapoteco-de-analco', app_version: '1783172350007', count: 1158, first_seen: new Date(Date.now() - 20 * 3600_000).toISOString(), last_seen: new Date(Date.now() - 15 * 60_000).toISOString() },
    ],
  },
  // A realistic agent pass: one contributor bulk-editing `river` via api_key +
  // a lighter session-authed pass on `galo`, with a couple of failures.
  api_v1: {
    total: 16_990,
    failures: 7,
    daily: [
      { day: '2026-06-20', count: 1240, failures: 0 },
      { day: '2026-06-21', count: 4310, failures: 2 },
      { day: '2026-06-22', count: 6890, failures: 5 },
      { day: '2026-06-23', count: 4550, failures: 0 },
    ],
    by_event: [
      { event: 'v1_entry_updated', count: 8089 },
      { event: 'v1_media_attached', count: 4737 },
      { event: 'v1_relationship_created', count: 3305 },
      { event: 'v1_entry_deleted', count: 859 },
      { event: 'v1_feedback_failed', count: 7 },
    ],
    by_dictionary: [
      { dictionary_id: 'river', count: 16_680 },
      { dictionary_id: 'galo', count: 310 },
    ],
    by_via: [
      { via: 'api_key', count: 16_680 },
      { via: 'session', count: 310 },
    ],
  },
  // A handful of star dictionaries pulling real outside traffic + a long tail.
  top_dictionaries: {
    distinct_dictionaries: 34,
    month: '2026-07',
    prev_month: '2026-06',
    site_visitors_month: 1284,
    site_visitors_prev_month: 1607,
    site_visitors_7d: 402,
    dictionaries: [
      { dictionary_id: 'apatani', name: 'Apatani', url: 'apatani', is_public: true, visitors_month: 214, anon_visitors_month: 198, visitors_prev_month: 271, visitors_7d: 61, visits_30d: 342 },
      { dictionary_id: 'river', name: 'River Dweller', url: 'river', is_public: true, visitors_month: 168, anon_visitors_month: 121, visitors_prev_month: 152, visitors_7d: 52, visits_30d: 261 },
      { dictionary_id: 'galo', name: 'Galo', url: 'galo', is_public: true, visitors_month: 133, anon_visitors_month: 127, visitors_prev_month: 118, visitors_7d: 44, visits_30d: 205 },
      { dictionary_id: 'zapoteco-de-analco', name: 'Zapoteco de Analco', url: 'zapoteco-de-analco', is_public: true, visitors_month: 96, anon_visitors_month: 74, visitors_prev_month: 88, visitors_7d: 28, visits_30d: 149 },
      { dictionary_id: 'onondaga', name: 'Onondaga', url: 'onondaga', is_public: false, visitors_month: 41, anon_visitors_month: 6, visitors_prev_month: 37, visitors_7d: 12, visits_30d: 63 },
    ],
  },
  missing_i18n_keys: {
    total: 875,
    distinct_keys: 237,
    sessions: 91,
    keys: [
      { key: 'sd.animal', sessions: 14, count: 41, locales: 'es' },
      { key: 'ps.verbo', sessions: 12, count: 33, locales: 'es' },
      { key: 'sd.people', sessions: 11, count: 22, locales: 'es' },
      { key: 'psAbbrev.sufijo verbal', sessions: 9, count: 18, locales: 'es' },
      { key: 'sd.fish', sessions: 7, count: 14, locales: 'es,pt' },
    ],
  },
  // A snapshot-cursor regression in progress: fresh viewers tripping snapshot_expired,
  // most never recovering to a rendered entry (the 2026-07-04 P1 fingerprint).
  boot_health: {
    failed_sessions: 40,
    recovered_sessions: 3,
    non_recovery_pct: 0.925,
    snapshot_expired_sessions: 34,
    by_message: [
      { message: 'initial dict sync failed', code: 'snapshot_expired', sessions: 40, count: 45, last_seen: new Date(Date.now() - 18 * 60_000).toISOString() },
      { message: 'Failed to read dict bundle from wa-sqlite', code: 'MISUSE', sessions: 21, count: 23, last_seen: new Date(Date.now() - 22 * 60_000).toISOString() },
      { message: 'leader_boot_failed', code: null, sessions: 5, count: 13, last_seen: new Date(Date.now() - 6 * 3600_000).toISOString() },
      { message: '[orama-watcher] delta scan failed', code: null, sessions: 5, count: 5, last_seen: new Date(Date.now() - 90 * 60_000).toISOString() },
    ],
    daily: [
      { day: '2026-07-02', sessions: 0 },
      { day: '2026-07-03', sessions: 5 },
      { day: '2026-07-04', sessions: 40 },
    ],
  },
  uptime: build_uptime(),
}

export const mock_analytics_bots: LogAnalytics = {
  ...mock_analytics,
  audience: 'bots',
  totals: { sessions: 402, errors: 24, real_errors: 13, stale_errors: 10, logs: 1760, unique_users: 0 },
}

export const mock_analytics_schema_drift: LogAnalytics = {
  ...mock_analytics,
  pipeline: { ...mock_analytics.pipeline, missing_syncable_tables: ['dictionary_partners'] },
}

export const empty_analytics: LogAnalytics = {
  audience: 'humans',
  window_days: 30,
  generated_at: '2026-06-23T13:04:00.000Z',
  daily: build_daily(30).map(point => ({ ...point, logs: 0, errors: 0, real_errors: 0, stale_errors: 0, sessions: 0, users: 0 })),
  deploys: [],
  totals: { sessions: 0, errors: 0, real_errors: 0, stale_errors: 0, logs: 0, unique_users: 0 },
  top_routes: [],
  top_events: [],
  by_source: [],
  error_clusters: [],
  capability: { total_sessions: 0, below_capability_sessions: 0, bot_sessions: 0, webdriver_sessions: 0, devices: [], os: [], browsers: [], db_tiers: [] },
  performance: { summary: [], daily: [], by_route: [], nav_by_route: [], lcp_by_route: [] },
  web_vitals: [],
  geo: { located_sessions: 0, areas: [], ttfb_by_country: [], ttfb_by_distance: [], lcp_by_country: [], lcp_by_distance: [] },
  errors_by_version: { current_version: '1719300000123', total: 0, current: 0, stale: 0, stale_pct: null, deploy_tail_errors: 0, deploy_tail_pct: null, versions: [] },
  pipeline: { last_log_at: null, last_session_start_at: null, last_server_log_at: null, retention_ran_at: null, hot_rows: 0, archived_rows: 0, missing_syncable_tables: [] },
  server_faults: { total: 0, schema_drift_count: 0, clusters: [] },
  event_coverage: {
    events: [
      { event: 'search_performed', seen: false, count: 0 },
      { event: 'dictionary_opened', seen: false, count: 0 },
      { event: 'entry_opened', seen: false, count: 0 },
      { event: 'audio_played', seen: false, count: 0 },
    ],
    never_emitted: 4,
  },
  leader_health: { timeouts: 0, recovered: 0, failed: 0, failed_no_leader: 0, failed_by_source: [], failed_by_code: [], failed_current: 0, failed_stale: 0 },
  sync_health: { total: 0, by_kind: [], client_behind: { total: 0, current: 0, stale: 0 }, stuck_pairs: 0, oldest_unresolved_at: null, stuck: [] },
  api_v1: { total: 0, failures: 0, daily: [], by_event: [], by_dictionary: [], by_via: [] },
  top_dictionaries: { distinct_dictionaries: 0, month: '2026-07', prev_month: '2026-06', site_visitors_month: 0, site_visitors_prev_month: 0, site_visitors_7d: 0, dictionaries: [] },
  missing_i18n_keys: { total: 0, distinct_keys: 0, sessions: 0, keys: [] },
  boot_health: { failed_sessions: 0, recovered_sessions: 0, non_recovery_pct: null, snapshot_expired_sessions: 0, by_message: [], daily: [] },
  uptime: { probes: 0, availability: null, ttfb: { p50: null, p95: null }, total: { p50: null, p95: null }, vantages: [], daily: [] },
}
