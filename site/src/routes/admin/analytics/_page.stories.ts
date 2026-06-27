import type { LogAnalytics } from '$lib/db/server/log-analytics'
import type { PageStory, StoryMeta } from 'svelte-look'
import type Component from './+page.svelte'

export const shared_meta: StoryMeta = {
  viewports: [{ width: 1000, height: 1500 }],
  csr: true,
}

function build_daily(days: number): LogAnalytics['daily'] {
  const end = new Date('2026-06-23T00:00:00.000Z')
  const out: LogAnalytics['daily'] = []
  for (let offset = days - 1; offset >= 0; offset--) {
    const day = new Date(end.getTime() - offset * 86_400_000).toISOString().slice(0, 10)
    // A rising trend with a couple of error spikes + a quiet stretch.
    const base = Math.round(40 + (days - offset) * 6 + Math.sin(offset) * 25)
    const logs = Math.max(0, base)
    const errors = offset === 4 ? 14 : offset === 11 ? 6 : offset % 7 === 0 ? 2 : 0
    out.push({
      day,
      logs,
      errors,
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
        viewer_boot: { p50: Math.round(1200 + wobble * 1.5), p95: Math.round(6400 + wobble * 3), count: 6 + (offset % 4) },
      },
    })
  }
  return {
    summary: [
      { name: 'page_load', count: 1240, p50: 1197, p90: 3344, p95: 4537, max: 14652 },
      { name: 'viewer_boot', count: 188, p50: 1184, p90: 4688, p95: 6493, max: 7687 },
      { name: 'search', count: 0, p50: null, p90: null, p95: null, max: null },
    ],
    daily,
  }
}

const analytics: LogAnalytics = {
  audience: 'humans',
  window_days: 30,
  generated_at: '2026-06-23T13:04:00.000Z',
  daily: build_daily(30),
  performance: build_perf(30),
  web_vitals: [
    { metric: 'LCP', count: 142, p50: 1820, p75: 2410, p95: 3900 },
    { metric: 'INP', count: 88, p50: 110, p75: 180, p95: 420 },
    { metric: 'CLS', count: 142, p50: 0.02, p75: 0.06, p95: 0.21 },
    { metric: 'FCP', count: 156, p50: 1120, p75: 1680, p95: 2700 },
    { metric: 'TTFB', count: 156, p50: 320, p75: 540, p95: 1190 },
  ],
  totals: { sessions: 188, errors: 24, logs: 2417, unique_users: 73 },
  top_routes: [
    { route: 'search', count: 642 },
    { route: 'home', count: 511 },
    { route: 'reader:chapter', count: 388 },
    { route: 'reader:doc', count: 214 },
    { route: 'reader:image', count: 142 },
    { route: 'account', count: 96 },
    { route: 'reader:video', count: 61 },
    { route: 'dr-house', count: 33 },
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
  browsers: [
    { label: 'Chrome 148', os: 'Linux', sessions: 83, below_capability: false },
    { label: 'Safari 17', os: 'macOS', sessions: 64, below_capability: false },
    { label: 'Chrome 149', os: 'Android', sessions: 27, below_capability: false },
    { label: 'Safari 14', os: 'macOS', sessions: 3, below_capability: true },
  ],
  capability: {
    total_sessions: 177,
    below_capability_sessions: 3,
    bot_sessions: 105,
    db_tiers: [
      { tier: 'opfs-worker', sessions: 171 },
      { tier: 'idb-main/floor (inferred)', sessions: 3 },
      { tier: 'unknown (legacy)', sessions: 3 },
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
  },
  errors_by_version: {
    current_version: '1719300000123',
    total: 24,
    current: 4,
    stale: 20,
    stale_pct: 20 / 24,
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
    failed: 1,
    failed_no_leader: 1,
    failed_by_source: [{ source: 'viewer', count: 1 }],
  },
}

export const Default: PageStory<typeof Component> = {
  props: { analytics } as never,
}

export const Bots: PageStory<typeof Component> = {
  props: { analytics: { ...analytics, audience: 'bots', totals: { sessions: 402, errors: 24, logs: 1760, unique_users: 0 } } } as never,
}

const empty_analytics: LogAnalytics = {
  audience: 'humans',
  window_days: 30,
  generated_at: '2026-06-23T13:04:00.000Z',
  daily: build_daily(30).map(point => ({ ...point, logs: 0, errors: 0, sessions: 0, users: 0 })),
  totals: { sessions: 0, errors: 0, logs: 0, unique_users: 0 },
  top_routes: [],
  top_events: [],
  by_source: [],
  error_clusters: [],
  browsers: [],
  capability: { total_sessions: 0, below_capability_sessions: 0, bot_sessions: 0, db_tiers: [] },
  performance: { summary: [], daily: [] },
  web_vitals: [],
  geo: { located_sessions: 0, areas: [], ttfb_by_country: [], ttfb_by_distance: [] },
  errors_by_version: { current_version: '1719300000123', total: 0, current: 0, stale: 0, stale_pct: null, versions: [] },
  pipeline: { last_log_at: null, last_session_start_at: null, last_server_log_at: null, retention_ran_at: null, hot_rows: 0, archived_rows: 0 },
  event_coverage: {
    events: [
      { event: 'search_performed', seen: false, count: 0 },
      { event: 'dictionary_opened', seen: false, count: 0 },
      { event: 'entry_opened', seen: false, count: 0 },
      { event: 'audio_played', seen: false, count: 0 },
    ],
    never_emitted: 4,
  },
  leader_health: { timeouts: 0, recovered: 0, failed: 0, failed_no_leader: 0, failed_by_source: [] },
}

export const Empty: PageStory<typeof Component> = {
  props: { analytics: empty_analytics } as never,
}
