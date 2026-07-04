<script lang="ts">
  import type { PageData } from './$types'
  import { log_insights } from '$lib/analytics/insights'
  import type { DonutDatum } from '$lib/charts/DonutChart.svelte'
  import type { Segment } from '$lib/charts/SegmentedBar.svelte'
  import BarChart from '$lib/charts/BarChart.svelte'
  import ComboChart from '$lib/charts/ComboChart.svelte'
  import DonutChart from '$lib/charts/DonutChart.svelte'
  import LineChart from '$lib/charts/LineChart.svelte'
  import SegmentedBar from '$lib/charts/SegmentedBar.svelte'
  import VitalBar from '$lib/charts/VitalBar.svelte'
  import { format_number, format_pct } from '$lib/constants'
  import { format_date_time, format_relative_time } from '$lib/utils/format-relative-time'

  interface Props {
    data: PageData
  }

  let { data }: Props = $props()
  const analytics = $derived(data.analytics)
  const totals = $derived(analytics.totals)
  const daily = $derived(analytics.daily)
  const insights = $derived(log_insights({ analytics }))

  const has_traffic = $derived(totals.sessions > 0 || totals.unique_users > 0)

  const USERS_COLOR = '#06b6d4'
  const traffic_series = $derived([
    { label: 'Sessions', color: 'var(--primary)', points: daily.map(point => ({ date: point.day, value: point.sessions })) },
    { label: 'Users', color: USERS_COLOR, points: daily.map(point => ({ date: point.day, value: point.users })) },
  ])
  const error_points = $derived(daily.map(point => ({ date: point.day, value: point.errors })))
  /** Known-noise rows (stale-chunk / gated / deploy) folded out of the real-fault headline. */
  const noise_errors = $derived(totals.errors - totals.real_errors)
  // Real faults as the danger area + known noise as a muted line, so a deploy-day
  // stale-chunk burst is visible without reading as a regression. When stale-build
  // errors exist, an overlay line folds deploy-day churn into the same read
  // (overlapping set: a stale-build error may be real OR noise — it's a diagnostic
  // overlay, not a stacked segment).
  const error_series = $derived([
    { label: 'Real errors', color: 'var(--danger)', area: true, points: daily.map(point => ({ date: point.day, value: point.real_errors })) },
    { label: 'Known noise', color: 'var(--text-muted, #94a3b8)', points: daily.map(point => ({ date: point.day, value: point.errors - point.real_errors })) },
    ...(totals.stale_errors > 0
      ? [{ label: 'From stale builds', color: 'var(--color-secondary)', points: daily.map(point => ({ date: point.day, value: point.stale_errors })) }]
      : []),
  ])
  // Deploy markers for the traffic + error timelines: a vertical chip per build
  // (app_version = build epoch ms), so a spike pins to the deploy that caused it.
  // Chip shows a friendly "5 minutes ago"; note shows the exact local times.
  function deploy_build_time(version: string): string {
    const ms = Number(version)
    return Number.isFinite(ms) && ms > 1e12 ? format_date_time(new Date(ms)) : version
  }
  const deploy_events = $derived(analytics.deploys.map(d => ({
    date: d.day,
    label: `⬆ ${format_relative_time(d.first_seen)}`,
    color: 'var(--color-secondary)',
    note: { title: 'Deploy', items: [
      { label: 'first seen', text: format_date_time(d.first_seen) },
      { label: 'build', text: deploy_build_time(d.version) },
      { label: 'sessions', text: format_number(d.sessions) },
    ] },
  })))
  // Routes ranked/valued by distinct sessions (breadth of use) — raw nav counts
  // let one loop-heavy session outrank every real route (1,869 same-route navs in
  // one session, 2026-07-03). Cold-rollup-only windows have no session dimension:
  // fall back to raw counts for the whole chart so units stay consistent.
  const routes_have_sessions = $derived(analytics.top_routes.some(row => row.sessions > 0))
  const route_bars = $derived(analytics.top_routes.map(row => ({ label: row.route, value: routes_have_sessions ? row.sessions : row.count })))
  const event_bars = $derived(analytics.top_events.map(row => ({ label: row.event, value: row.count, color: USERS_COLOR })))

  // --- Agent API (v1) activity — the server-emitted `v1_*` audit rows. ---
  const api_v1 = $derived(analytics.api_v1)
  const api_v1_daily_points = $derived(api_v1.daily.map(point => ({ date: point.day, value: point.count })))
  const api_v1_event_bars = $derived(api_v1.by_event.map(row => ({ label: row.event.replace(/^v1_/, ''), value: row.count })))
  const api_v1_dict_bars = $derived(api_v1.by_dictionary.map(row => ({ label: row.dictionary_id, value: row.count, color: USERS_COLOR })))
  const API_VIA_COLORS: Record<string, string> = { api_key: '#7c3aed', session: '#06b6d4' }
  const api_v1_via_segments = $derived<Segment[]>(api_v1.by_via.map(row => ({
    label: row.via,
    value: row.count,
    color: API_VIA_COLORS[row.via] ?? '#94a3b8',
  })))
  const capability = $derived(analytics.capability)
  const below_pct = $derived(capability.total_sessions > 0 ? capability.below_capability_sessions / capability.total_sessions : 0)

  // --- Device / OS / browser / local-DB visuals. Semantic palettes per axis. ---
  const DEVICE_META: Record<string, { label: string, color: string, icon?: string }> = {
    desktop: { label: 'Desktop', color: '#7c3aed', icon: '🖥️' },
    mobile: { label: 'Mobile', color: '#06b6d4', icon: '📱' },
    tablet: { label: 'Tablet', color: '#f59e0b' },
  }
  const OS_COLORS: Record<string, string> = {
    Windows: '#7c3aed', macOS: '#10b981', iOS: '#f59e0b', iPadOS: '#8b5cf6',
    Android: '#06b6d4', ChromeOS: '#ec4899', Linux: '#64748b', Other: '#94a3b8',
  }
  const BROWSER_COLORS: Record<string, string> = {
    'Chrome': '#7c3aed', 'Safari': '#06b6d4', 'Edge': '#10b981', 'Firefox': '#f59e0b',
    'Samsung Internet': '#ec4899', 'Opera': '#ef4444', 'Other': '#94a3b8',
  }
  function db_tier_color(tier: string): string {
    if (tier.startsWith('opfs'))
      return '#10b981'
    if (tier.startsWith('idb'))
      return '#f59e0b'
    return '#94a3b8'
  }

  const device_segments = $derived<Segment[]>(capability.devices.map(row => ({
    label: DEVICE_META[row.device]?.label ?? row.device,
    value: row.sessions,
    color: DEVICE_META[row.device]?.color ?? '#94a3b8',
    icon: DEVICE_META[row.device]?.icon,
  })))
  const os_rings = $derived<DonutDatum[]>(capability.os.map(row => ({
    label: row.os,
    value: row.sessions,
    color: OS_COLORS[row.os] ?? '#94a3b8',
    children: row.versions.map(version => ({ label: version.version, value: version.sessions })),
  })))
  const browser_rings = $derived<DonutDatum[]>(capability.browsers.map(row => ({
    label: row.browser,
    value: row.sessions,
    color: BROWSER_COLORS[row.browser] ?? '#94a3b8',
  })))
  const db_tier_segments = $derived<Segment[]>(capability.db_tiers.map(row => ({
    label: row.tier,
    value: row.sessions,
    color: db_tier_color(row.tier),
  })))

  const perf = $derived(analytics.performance)
  const perf_has_data = $derived(perf.summary.some(metric => metric.count > 0))
  // Days with no samples are dropped (not zero-filled) so the line reflects real
  // measured latency rather than dipping to 0 on quiet days.
  function perf_series(name: string) {
    const days = perf.daily.filter(point => point.metrics[name]?.count)
    return [
      { label: 'p50', color: 'var(--primary)', points: days.map(point => ({ date: point.day, value: point.metrics[name].p50 })) },
      { label: 'p95', color: USERS_COLOR, points: days.map(point => ({ date: point.day, value: point.metrics[name].p95 })) },
    ]
  }
  const page_load_series = $derived(perf_series('page_load'))
  const search_series = $derived(perf_series('search'))
  function format_ms(ms: number): string {
    if (ms == null)
      return '—'
    return ms >= 1000 ? `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)}s` : `${Math.round(ms)}ms`
  }
  const PERF_LABELS: Record<string, string> = { page_load: 'Page load', search: 'Search', web_vital: 'Web vital' }
  function perf_label(name: string): string {
    return PERF_LABELS[name] ?? name
  }

  // --- Core Web Vitals. Each metric renders as a graded VitalBar (p75 vs Google
  // thresholds); metric metadata + thresholds live in that component. ---
  const web_vitals = $derived(analytics.web_vitals)

  const geo = $derived(analytics.geo)
  const has_geo = $derived(geo.areas.length > 0 || geo.ttfb_by_country.length > 0 || geo.ttfb_by_distance.length > 0)
  // Country code → flag emoji (regional-indicator pair). Non-ISO sentinels (XX/T1) fall back to a globe.
  function country_flag(code: string): string {
    if (!/^[A-Z]{2}$/i.test(code) || code.toUpperCase() === 'XX')
      return '🌐'
    return String.fromCodePoint(...[...code.toUpperCase()].map(ch => 0x1F1E6 + ch.charCodeAt(0) - 65))
  }
  const area_bars = $derived(geo.areas.map(area => ({ label: `${country_flag(area.country)} ${area.key}`, value: area.sessions })))

  const pipeline = $derived(analytics.pipeline)
  const server_faults = $derived(analytics.server_faults)
  const errors_by_version = $derived(analytics.errors_by_version)
  const event_coverage = $derived(analytics.event_coverage)
  const clusters = $derived(analytics.error_clusters)
  const leader = $derived(analytics.leader_health)
  const missing_i18n = $derived(analytics.missing_i18n_keys)
  // Build ids are long; show a short trailing slice for readability.
  function short_version(version: string | null): string {
    if (!version)
      return 'unknown'
    return version.length > 10 ? `…${version.slice(-8)}` : version
  }
  function ago(iso: string | null): string {
    if (!iso)
      return 'never'
    const ms = Date.now() - new Date(iso).getTime()
    if (Number.isNaN(ms))
      return 'never'
    const mins = Math.round(ms / 60000)
    if (mins < 1)
      return 'just now'
    if (mins < 60)
      return `${mins}m ago`
    const hours = Math.round(mins / 60)
    if (hours < 48)
      return `${hours}h ago`
    return `${Math.round(hours / 24)}d ago`
  }
  // Ingestion verdict: distinguishes a broken pipe from a quiet one.
  const ingestion_recent = $derived(!!pipeline.last_log_at && Date.now() - new Date(pipeline.last_log_at).getTime() < 24 * 3600_000)

  const error_suffix = $derived(insights.error_rate != null ? `, ${format_pct(insights.error_rate)} error rate` : '')
  const headline = $derived(
    `${format_number(totals.logs)} logs from ${format_number(totals.unique_users)} users across ${format_number(totals.sessions)} sessions over the last ${analytics.window_days} days${error_suffix}.`,
  )

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  function short_day(day: string): string {
    const [, month, date] = day.split('-').map(Number)
    return `${MONTH_NAMES[(month || 1) - 1]} ${date}`
  }
  function one_decimal(value: number | null): string {
    return value == null ? '—' : value.toFixed(1)
  }
  function short_time(iso: string): string {
    return iso.replace('T', ' ').slice(0, 16)
  }
</script>

<svelte:head><title>Analytics · Admin</title></svelte:head>

<div class="analytics">
  <header class="head">
    <h1>Analytics</h1>
    <span class="sub">last {analytics.window_days} days · generated {short_time(analytics.generated_at)}</span>
    <div class="audience-toggle" role="group" aria-label="Audience filter">
      <a class="seg" class:active={analytics.audience === 'humans'} href="?audience=humans" data-sveltekit-noscroll>🧑 Humans</a>
      <a class="seg" class:active={analytics.audience === 'bots'} href="?audience=bots" data-sveltekit-noscroll>🤖 Bots</a>
    </div>
  </header>

  {#if analytics.audience === 'bots'}
    <p class="audience-note">🤖 Showing <b>bot / crawler / AI-agent</b> traffic — usage, routes, events, geo and timings below are bot-only. Diagnostics (errors, build, leader, clusters) always show everyone.</p>
  {/if}

  {#if pipeline.missing_syncable_tables.length}
    <section class="schema-drift">
      <span class="dot danger"></span>
      <span>
        <b>Schema drift</b> — {pipeline.missing_syncable_tables.length} syncable
        {pipeline.missing_syncable_tables.length === 1 ? 'table is' : 'tables are'} missing from shared.db:
        <code>{pipeline.missing_syncable_tables.join(', ')}</code>. Admin sync skip-logs these; ship a backfill migration.
      </span>
    </section>
  {/if}

  <section class="pipeline" class:warn={!ingestion_recent}>
    <div class="pipeline-verdict">
      <span class="dot" class:ok={ingestion_recent} class:idle={!ingestion_recent}></span>
      {#if ingestion_recent}
        Pipeline live — last log {ago(pipeline.last_log_at)}
      {:else if pipeline.last_log_at}
        No ingestion in 24h — last log {ago(pipeline.last_log_at)} (broken, or no traffic?)
      {:else}
        No telemetry ever received — awaiting first traffic
      {/if}
    </div>
    <div class="pipeline-stats">
      <span><b>{format_number(pipeline.hot_rows)}</b> hot · <b>{format_number(pipeline.archived_rows)}</b> archived</span>
      <span>session_start {ago(pipeline.last_session_start_at)}</span>
      <span>server log {ago(pipeline.last_server_log_at)}</span>
      <span>retention {ago(pipeline.retention_ran_at)}</span>
    </div>
  </section>

  <section class="cards">
    {#each [['Sessions', analytics.totals.sessions], ['Unique users', analytics.totals.unique_users], ['Errors', analytics.totals.real_errors], ['Log rows', analytics.totals.logs]] as [label, value] (label)}
      <div class="card">
        <div class="value" class:danger={label === 'Errors' && Number(value) > 0}>{format_number(Number(value))}</div>
        <div class="label">
          {label}{#if label === 'Errors' && noise_errors > 0}
            <span class="card-hint">+{format_number(noise_errors)} known-noise</span>
          {/if}{#if label === 'Errors' && totals.stale_errors > 0}
            <span class="card-hint">{format_number(totals.stale_errors)} from stale builds</span>
          {/if}
        </div>
      </div>
    {/each}
  </section>

  {#if totals.logs === 0}
    <p class="empty">No log activity in this window yet. Once real traffic lands the charts below
      fill in. The nightly rollup keeps history after raw rows are archived.</p>
  {:else}
    <p class="headline">{headline}</p>
  {/if}

  <section class="insights">
    <div class="insight">
      <div class="insight-value" class:danger={(insights.error_rate ?? 0) > 0}>{insights.error_rate != null ? format_pct(insights.error_rate) : '—'}</div>
      <div class="insight-label">Error rate</div>
      <div class="insight-sub">real faults ÷ logs</div>
    </div>
    <div class="insight">
      <div class="insight-value">{one_decimal(insights.sessions_per_day)}</div>
      <div class="insight-label">Sessions / day</div>
      <div class="insight-sub">avg over {analytics.window_days}d</div>
    </div>
    <div class="insight">
      <div class="insight-value">{one_decimal(insights.logs_per_session)}</div>
      <div class="insight-label">Logs / session</div>
      <div class="insight-sub">engagement depth</div>
    </div>
    <div class="insight">
      <div class="insight-value">{insights.busiest_day ? short_day(insights.busiest_day.day) : '—'}</div>
      <div class="insight-label">Busiest day</div>
      <div class="insight-sub">{insights.busiest_day ? `${format_number(insights.busiest_day.logs)} logs` : 'no activity yet'}</div>
    </div>
    <div class="insight">
      <div class="insight-value" class:pos={(insights.wow_change ?? 0) >= 0 && insights.wow_change != null} class:neg={(insights.wow_change ?? 0) < 0}>
        {insights.wow_change != null ? format_pct(insights.wow_change, { signed: true }) : '—'}
      </div>
      <div class="insight-label">Traffic · WoW</div>
      <div class="insight-sub">sessions, last 7d vs prior</div>
    </div>
  </section>

  <section class="panel">
    <h2>Traffic <span class="hint">sessions vs unique users</span></h2>
    {#if has_traffic}
      <ComboChart series={traffic_series} events={deploy_events} event_icon="⬆" height={200} value_format={format_number} />
    {:else}
      <p class="muted">No sessions logged yet.</p>
    {/if}
  </section>

  <section class="panel">
    <h2>Errors per day <span class="hint">real vs known-noise{totals.stale_errors > 0 ? ' · stale-build overlay' : ''} · ⬆ = deploy</span></h2>
    {#if totals.errors > 0}
      {#if noise_errors > 0 || totals.stale_errors > 0}
        <ComboChart series={error_series} events={deploy_events} event_icon="⬆" height={200} value_format={format_number} />
      {:else}
        <LineChart series={error_points} events={deploy_events} event_icon="⬆" area color="var(--danger)" height={200} y_format={format_number} tip_format={format_number} />
      {/if}
    {:else}
      <p class="muted">No errors recorded. 🎉</p>
    {/if}
  </section>

  <section class="panel">
    <h2>Server faults <span class="hint">source=server · error-level · fix-now set · hot window</span></h2>
    {#if server_faults.total === 0}
      <p class="muted">No server-side faults in the hot window. 🎉</p>
    {:else}
      <div class="ver-split">
        <div class="ver-stat">
          <div class="ver-value danger">{format_number(server_faults.total)}</div>
          <div class="ver-label">Server faults</div>
          <div class="ver-sub">{server_faults.clusters.length} distinct {server_faults.clusters.length === 1 ? 'class' : 'classes'}</div>
        </div>
        <div class="ver-stat">
          <div class="ver-value" class:danger={server_faults.schema_drift_count > 0}>{format_number(server_faults.schema_drift_count)}</div>
          <div class="ver-label">Schema-drift faults</div>
          <div class="ver-sub">SqliteError / dropped column · ship a migration</div>
        </div>
      </div>
      <table class="src-table">
        <thead><tr><th>Route</th><th>Fault</th><th>Status</th><th>Last seen</th><th>Count</th></tr></thead>
        <tbody>
          {#each server_faults.clusters as cluster (`${cluster.route}|${cluster.message}`)}
            <tr class:drift-row={cluster.is_schema_drift}>
              <td>{cluster.route ?? '—'}</td>
              <td>{#if cluster.is_schema_drift}<span class="drift-tag" title="Schema drift — post-migration regression">drift</span> {/if}{cluster.message}</td>
              <td>{cluster.statuses ?? '—'}</td>
              <td>{ago(cluster.last_seen)}</td>
              <td class="danger">{format_number(cluster.count)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>

  <div class="grid">
    <section class="panel">
      <h2>Errors by build version <span class="hint">current vs stale bundle · hot window</span></h2>
      {#if errors_by_version.total === 0}
        <p class="muted">No errors in the hot window. 🎉</p>
      {:else}
        <div class="ver-split">
          <div class="ver-stat">
            <div class="ver-value" class:danger={(errors_by_version.stale_pct ?? 0) > 0.5}>{errors_by_version.stale_pct != null ? format_pct(errors_by_version.stale_pct) : '—'}</div>
            <div class="ver-label">Errors from a stale bundle</div>
            <div class="ver-sub">{format_number(errors_by_version.stale)} of {format_number(errors_by_version.total)} on a non-current build</div>
          </div>
          <div class="ver-stat">
            <div class="ver-value">{format_number(errors_by_version.current)}</div>
            <div class="ver-label">Current-build errors</div>
            <div class="ver-sub">build {short_version(errors_by_version.current_version)}</div>
          </div>
        </div>
        <table class="src-table">
          <thead><tr><th>Build</th><th>Errors</th></tr></thead>
          <tbody>
            {#each errors_by_version.versions as row (row.version)}
              <tr><td>{short_version(row.version)}{row.is_current ? ' (current)' : ''}</td><td class:danger={!row.is_current}>{format_number(row.errors)}</td></tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </section>

    <section class="panel">
      <h2>Leader-worker DB health <span class="hint">live_query_* · hot window</span></h2>
      <div class="ver-split">
        <div class="ver-stat">
          <div class="ver-value" class:danger={leader.failed > 0}>{format_number(leader.failed)}</div>
          <div class="ver-label">Failed loads</div>
          <div class="ver-sub">{format_number(leader.failed_no_leader)} with no leader (wedged)</div>
          {#if leader.failed > 0}
            <div class="ver-sub">
              <span class:danger={leader.failed_current > 0}>{format_number(leader.failed_current)} on current build</span>
              · {format_number(leader.failed_stale)} stale
            </div>
          {/if}
        </div>
        <div class="ver-stat">
          <div class="ver-value">{format_number(leader.timeouts)}</div>
          <div class="ver-label">Timeouts</div>
          <div class="ver-sub">{format_number(leader.recovered)} recovered</div>
        </div>
      </div>
      {#if leader.failed > 0}
        <div class="grid">
          <table class="src-table">
            <thead><tr><th>Failed by source</th><th>Count</th></tr></thead>
            <tbody>
              {#each leader.failed_by_source as row (row.source)}
                <tr><td>{row.source}</td><td class="danger">{format_number(row.count)}</td></tr>
              {/each}
            </tbody>
          </table>
          <table class="src-table">
            <thead><tr><th>Failed by code</th><th>Count</th></tr></thead>
            <tbody>
              {#each leader.failed_by_code as row (row.code)}
                <tr><td>{row.code}</td><td class="danger">{format_number(row.count)}</td></tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else if leader.timeouts === 0}
        <p class="muted">No leader-worker query stalls. 🎉</p>
      {:else}
        <p class="muted">Timeouts present but all recovered — healthy self-heal signature.</p>
      {/if}
    </section>
  </div>

  <section class="panel">
    <h2>Performance <span class="hint">client timings · p50 / p95 · hot window only</span></h2>
    {#if perf_has_data}
      <div class="perf-summary">
        {#each perf.summary as metric (metric.name)}
          {#if metric.count > 0}
            <div class="perf-stat">
              <div class="perf-name">{perf_label(metric.name)}</div>
              <div class="perf-nums">
                <span><b>{format_ms(metric.p50 ?? 0)}</b> p50</span>
                <span><b>{format_ms(metric.p95 ?? 0)}</b> p95</span>
                <span class="muted-inline">{format_ms(metric.max ?? 0)} max · n={format_number(metric.count)}</span>
              </div>
              {#if metric.slowest}
                <div class="perf-slowest" title={metric.slowest.route}>
                  slowest {format_ms(metric.slowest.duration_ms)} · <span class="perf-route">{metric.slowest.route}</span>
                </div>
              {/if}
            </div>
          {/if}
        {/each}
      </div>
      <div class="grid">
        {#if page_load_series[0].points.length}
          <div>
            <h3 class="perf-h3">Page load <span class="hint">ms</span></h3>
            <ComboChart series={page_load_series} height={180} value_format={format_ms} />
          </div>
        {/if}
        {#if search_series[0].points.length}
          <div>
            <h3 class="perf-h3">Search <span class="hint">ms</span></h3>
            <ComboChart series={search_series} height={180} value_format={format_ms} />
          </div>
        {/if}
      </div>
      {#if perf.by_route.length}
        <h3 class="perf-h3">Page load by route <span class="hint">slowest p95 first · ms</span></h3>
        <table class="route-perf">
          <thead>
            <tr><th>Route</th><th>p50</th><th>p95</th><th>max</th><th>n</th></tr>
          </thead>
          <tbody>
            {#each perf.by_route as row (row.route)}
              <tr>
                <td class="perf-route">{row.route}</td>
                <td>{format_ms(row.p50 ?? 0)}</td>
                <td><b>{format_ms(row.p95 ?? 0)}</b></td>
                <td class="muted-inline">{format_ms(row.max ?? 0)}</td>
                <td class="muted-inline">{format_number(row.count)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    {:else}
      <p class="muted">No performance timings in window yet. Page-load, viewer-boot, and search timings appear here.</p>
    {/if}
  </section>

  <section class="panel">
    <h2>Core Web Vitals <span class="hint">graded on the typical (75th-percentile) visit · recent traffic · real people, bots excluded</span></h2>
    {#if web_vitals.length}
      <div class="vitals">
        {#each web_vitals as vital (vital.metric)}
          <VitalBar {vital} />
        {/each}
      </div>
    {:else if totals.sessions > 0}
      <p class="muted">No Web Vitals landed despite {format_number(totals.sessions)} human session{totals.sessions === 1 ? '' : 's'}. FCP/TTFB report on load; LCP/INP/CLS only finalize on real interaction or page-hide — so short or automated sessions may never flush them. If this stays empty under genuine traffic, verify <code>init_web_vitals()</code>.</p>
    {:else}
      <p class="muted">No Web Vitals in window yet. LCP, INP, CLS, FCP and TTFB appear here once real sessions land.</p>
    {/if}
  </section>

  <section class="panel">
    <h2>Geography <span class="hint">approximate · Cloudflare edge · {format_number(geo.located_sessions)} located sessions</span></h2>
    {#if has_geo}
      <div class="grid">
        <div>
          <h3 class="perf-h3">Top areas <span class="hint">sessions</span></h3>
          {#if area_bars.length}
            <BarChart data={area_bars} format={format_number} label_width={120} />
          {:else}
            <p class="muted">No located sessions yet.</p>
          {/if}
        </div>
        <div>
          <h3 class="perf-h3">TTFB by distance to Boston <span class="hint">p50 / p95 · hot window</span></h3>
          {#if geo.ttfb_by_distance.length}
            <table class="src-table">
              <thead><tr><th>Distance</th><th>p50</th><th>p95</th><th>n</th></tr></thead>
              <tbody>
                {#each geo.ttfb_by_distance as row (row.label)}
                  <tr><td>{row.label}</td><td>{format_ms(row.p50 ?? 0)}</td><td>{format_ms(row.p95 ?? 0)}</td><td>{format_number(row.count)}</td></tr>
                {/each}
              </tbody>
            </table>
          {:else if geo.located_sessions > 0}
            <p class="cap-warn">⚠️ {format_number(geo.located_sessions)} located sessions but no coordinates — the Cloudflare “Add visitor location headers” managed transform appears OFF. Enable it to get region/city + the distance-to-Boston TTFB split.</p>
          {:else}
            <p class="muted">No coordinates yet — needs the CF location-headers transform.</p>
          {/if}
        </div>
      </div>
      {#if geo.ttfb_by_country.length}
        <h3 class="perf-h3 geo-country-h">TTFB by country <span class="hint">p50 / p95 · hot window</span></h3>
        <table class="src-table">
          <thead><tr><th>Country</th><th>p50</th><th>p95</th><th>n</th></tr></thead>
          <tbody>
            {#each geo.ttfb_by_country as row (row.label)}
              <tr><td>{country_flag(row.label)} {row.label}</td><td>{format_ms(row.p50 ?? 0)}</td><td>{format_ms(row.p95 ?? 0)}</td><td>{format_number(row.count)}</td></tr>
            {/each}
          </tbody>
        </table>
      {/if}
    {:else}
      <p class="muted">No geolocated sessions in window yet. Country arrives once real traffic lands; region / city / coordinates (and the distance-to-Boston split) need the Cloudflare “Add visitor location headers” managed transform enabled.</p>
    {/if}
  </section>

  <div class="grid">
    <section class="panel">
      <h2>Top routes <span class="hint">{routes_have_sessions ? 'by distinct sessions' : 'by nav count (archived days only)'}</span></h2>
      {#if route_bars.length}
        <BarChart data={route_bars} format={format_number} label_width={132} />
      {:else}
        <p class="muted">No navigation logged yet.</p>
      {/if}
    </section>

    <section class="panel">
      <h2>Top events</h2>
      {#if event_bars.length}
        <BarChart data={event_bars} format={format_number} label_width={172} />
      {:else}
        <p class="muted">No analytics events yet. Search / dictionary / entry / audio events appear here.</p>
      {/if}
    </section>
  </div>

  <section class="panel">
    <h2>Agent API activity <span class="hint">/api/v1 writes · server v1_* audit rows · hot window</span></h2>
    {#if api_v1.total === 0}
      <p class="muted">No /api/v1 activity in the hot window. Agent edits (per-dict API keys) land here.</p>
    {:else}
      <div class="ver-split">
        <div class="ver-stat">
          <div class="ver-value">{format_number(api_v1.total)}</div>
          <div class="ver-label">Operations</div>
          <div class="ver-sub">{format_number(api_v1.by_dictionary.length)} {api_v1.by_dictionary.length === 1 ? 'dictionary' : 'dictionaries'} touched</div>
        </div>
        <div class="ver-stat">
          <div class="ver-value" class:danger={api_v1.failures > 0}>{format_number(api_v1.failures)}</div>
          <div class="ver-label">Failures</div>
          <div class="ver-sub">error-level v1 rows</div>
        </div>
      </div>
      {#if api_v1_daily_points.length > 1}
        <LineChart series={api_v1_daily_points} area color="#7c3aed" height={140} y_format={format_number} tip_format={format_number} />
      {/if}
      <div class="grid dev-grid">
        <div class="dev-block">
          <div class="block-h">By operation <span class="hint">v1_ prefix dropped</span></div>
          <BarChart data={api_v1_event_bars} format={format_number} label_width={172} />
        </div>
        <div class="dev-block">
          <div class="block-h">By dictionary</div>
          <BarChart data={api_v1_dict_bars} format={format_number} label_width={132} />
        </div>
      </div>
      <div class="dev-block">
        <div class="block-h">Auth channel <span class="hint">context.via</span></div>
        <SegmentedBar segments={api_v1_via_segments} format={format_number} />
      </div>
    {/if}
  </section>

  <section class="panel">
    <h2>Missing translations <span class="hint">i18n gap worklist · human sessions · hot window</span></h2>
    {#if missing_i18n.total === 0}
      <p class="muted">No missing translation keys in the hot window. 🎉</p>
    {:else}
      <div class="ver-split">
        <div class="ver-stat">
          <div class="ver-value">{format_number(missing_i18n.distinct_keys)}</div>
          <div class="ver-label">Missing keys</div>
          <div class="ver-sub">{format_number(missing_i18n.total)} rows · {format_number(missing_i18n.sessions)} sessions</div>
        </div>
        <div class="ver-stat">
          <div class="ver-label">Fill at <a href="/translate">/translate</a></div>
          <div class="ver-sub">one row per key per session — a live translation-gap worklist</div>
        </div>
      </div>
      <table class="src-table">
        <thead><tr><th>Key</th><th>Locales</th><th>Sessions</th><th>Rows</th></tr></thead>
        <tbody>
          {#each missing_i18n.keys as row (row.key)}
            <tr>
              <td><code>{row.key}</code></td>
              <td>{row.locales ?? '—'}</td>
              <td>{format_number(row.sessions)}</td>
              <td>{format_number(row.count)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>

  <section class="panel">
    <h2>Event coverage <span class="hint">declared analytics events vs seen · self-instrumentation</span></h2>
    {#if event_coverage.never_emitted > 0}
      <p class="cap-warn">⚠️ {event_coverage.never_emitted} of {event_coverage.events.length} declared events have NOT been seen this window — either no one hit that path, or the event isn't wired up.</p>
    {/if}
    <table class="src-table">
      <thead><tr><th>Event</th><th>Status</th><th>Count</th></tr></thead>
      <tbody>
        {#each event_coverage.events as row (row.event)}
          <tr>
            <td class="mono">{row.event}</td>
            <td>{row.seen ? '✅ seen' : '⚪ never'}</td>
            <td class:muted={!row.seen}>{format_number(row.count)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </section>

  <section class="panel">
    <h2>By source</h2>
    <table class="src-table">
      <thead><tr><th>Source</th><th>Logs</th><th>Errors</th></tr></thead>
      <tbody>
        {#each analytics.by_source as row (row.source)}
          <tr><td>{row.source}</td><td>{format_number(row.logs)}</td><td class:danger={row.errors > 0}>{format_number(row.errors)}</td></tr>
        {:else}
          <tr><td colspan="3" class="muted">No logs in window.</td></tr>
        {/each}
      </tbody>
    </table>
  </section>

  <section class="panel">
    <h2>Browsers &amp; devices <span class="hint">human sessions, last {analytics.window_days}d{capability.bot_sessions > 0 ? ` · ${format_number(capability.bot_sessions)} bot sessions excluded` : ''}</span></h2>
    {#if capability.total_sessions === 0}
      <p class="muted">No human sessions in window.</p>
    {:else}
      {#if capability.below_capability_sessions > 0}
        <p class="cap-warn">
          ⚠️ {format_number(capability.below_capability_sessions)} of {format_number(capability.total_sessions)} sessions ({format_pct(below_pct)}) are on a browser that can't run the local-first DB worker (Safari &lt; 15.4) — they fall back to main-thread IndexedDB or SSR.
        </p>
      {/if}
      <div class="dev-block">
        <div class="block-h">Device</div>
        <SegmentedBar segments={device_segments} format={format_number} />
      </div>
      <div class="grid dev-grid">
        <div class="dev-block">
          <div class="block-h">Operating systems <span class="hint">versions in legend</span></div>
          <DonutChart data={os_rings} nested={false} center_value={format_number(capability.total_sessions)} center_label="sessions" format={format_number} />
        </div>
        <div class="dev-block">
          <div class="block-h">Browsers <span class="hint">by family</span></div>
          <DonutChart data={browser_rings} format={format_number} />
        </div>
      </div>
      <div class="dev-block">
        <div class="block-h">Local-DB engine <span class="hint">storage tier the session actually ran</span></div>
        <SegmentedBar segments={db_tier_segments} format={format_number} />
      </div>
    {/if}
  </section>

  <section class="panel">
    <h2>Error clusters <span class="hint">grouped by message + stack · hot window · all traffic · known-noise sunk</span></h2>
    {#if clusters.length === 0}
      <p class="muted">No errors recorded. 🎉</p>
    {:else}
      <table class="err-table">
        <thead><tr><th>#</th><th>Lvl</th><th>Src</th><th>Users</th><th>Last</th><th>Message</th></tr></thead>
        <tbody>
          {#each clusters as row (row.message + row.stack_head)}
            <tr class:noise={row.is_noise}>
              <td class="nowrap">{format_number(row.count)}</td>
              <td class="lvl">{row.level}</td>
              <td>{row.sources}</td>
              <td>{format_number(row.users)}</td>
              <td class="nowrap mono">{short_time(row.last_seen)}</td>
              <td class="msg" title={row.stack_head}>{row.is_noise ? '⚪ ' : ''}{row.message}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>
</div>

<style>
  .analytics {
    max-width: 70rem;
    margin: 0 auto;
    padding: 1.5rem 1rem 4rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .head {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .head h1 {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
  }
  .sub {
    color: var(--color-secondary);
    font-size: 0.8125rem;
  }
  .audience-toggle {
    margin-left: auto;
    display: inline-flex;
    border: 1px solid var(--border-color, rgba(127, 127, 127, 0.25));
    border-radius: 0.5rem;
    overflow: hidden;
    align-self: center;
  }
  .audience-toggle .seg {
    padding: 0.3rem 0.7rem;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--color-secondary);
    text-decoration: none;
    background: var(--surface);
  }
  .audience-toggle .seg + .seg {
    border-left: 1px solid var(--border-color, rgba(127, 127, 127, 0.25));
  }
  .audience-toggle .seg.active {
    background: var(--primary);
    color: #fff;
  }
  .audience-note {
    margin: 0;
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--primary) 10%, transparent);
    font-size: 0.85rem;
  }
  tr.noise {
    opacity: 0.55;
  }
  .pipeline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-left: 3px solid var(--success, #16a34a);
    border-radius: 0.625rem;
    padding: 0.625rem 0.875rem;
    font-size: 0.8125rem;
  }
  .pipeline.warn {
    border-left-color: var(--warning, #d97706);
  }
  .schema-drift {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: color-mix(in srgb, var(--danger) 10%, transparent);
    border: 1px solid var(--danger);
    border-left: 3px solid var(--danger);
    border-radius: 0.625rem;
    padding: 0.625rem 0.875rem;
    font-size: 0.8125rem;
  }
  .schema-drift .dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .schema-drift .dot.danger {
    background: var(--danger);
  }
  .schema-drift code {
    font-weight: 600;
  }
  .pipeline-verdict {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
  }
  .pipeline .dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .pipeline .dot.ok {
    background: var(--success, #16a34a);
  }
  .pipeline .dot.idle {
    background: var(--warning, #d97706);
  }
  .pipeline-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1rem;
    color: var(--color-secondary);
    font-variant-numeric: tabular-nums;
  }
  .ver-split {
    display: flex;
    gap: 1.5rem;
    margin-bottom: 0.75rem;
  }
  .ver-stat {
    flex: 1;
  }
  .ver-value {
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
  }
  .ver-value.danger {
    color: var(--danger);
  }
  .ver-label {
    font-size: 0.8125rem;
    margin-top: 0.125rem;
  }
  .ver-sub {
    color: var(--color-secondary);
    font-size: 0.75rem;
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
  }
  .card {
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-radius: 0.625rem;
    padding: 0.875rem 1rem;
  }
  .card .value {
    font-size: 1.625rem;
    font-weight: 700;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
  }
  .card .value.danger,
  td.danger {
    color: var(--danger);
  }
  .drift-row td {
    background: color-mix(in srgb, var(--danger) 8%, transparent);
  }
  .drift-tag {
    display: inline-block;
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--danger);
    border: 1px solid var(--danger);
    border-radius: 0.25rem;
    padding: 0 0.25rem;
    vertical-align: middle;
  }
  .card .label {
    color: var(--color-secondary);
    font-size: 0.75rem;
    margin-top: 0.25rem;
  }
  .card .card-hint {
    display: block;
    font-size: 0.65rem;
    opacity: 0.7;
  }
  .headline {
    font-size: 0.9rem;
    line-height: 1.5;
    margin: 0;
    color: var(--color);
  }
  .insights {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.75rem;
  }
  .insight {
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 0.7rem 0.8rem;
  }
  .insight-value {
    font-size: 1.35rem;
    font-weight: 700;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
  }
  .insight-value.pos { color: var(--success); }
  .insight-value.neg, .insight-value.danger { color: var(--danger); }
  .insight-label {
    font-size: 0.72rem;
    font-weight: 600;
    margin-top: 0.3rem;
  }
  .insight-sub {
    color: var(--color-secondary);
    font-size: 0.7rem;
    margin-top: 0.15rem;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
  }
  .panel {
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-radius: 0.625rem;
    padding: 1rem 1.125rem;
  }
  .panel h2 {
    font-size: 0.9375rem;
    font-weight: 600;
    margin: 0 0 0.75rem;
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .hint {
    font-weight: 400;
    font-size: 0.72rem;
    color: var(--color-secondary);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
  }
  th {
    text-align: left;
    color: var(--color-secondary);
    font-weight: 500;
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    border-bottom: 1px solid var(--border-color);
  }
  td {
    padding: 0.3rem 0.5rem;
    border-bottom: 1px solid var(--border-color);
    vertical-align: top;
  }
  .src-table { max-width: 22rem; }
  .perf-summary {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.75rem;
    margin-bottom: 1rem;
  }
  .vitals {
    display: grid;
    gap: 0.6rem;
    max-width: 680px;
  }
  .perf-stat {
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 0.6rem 0.75rem;
  }
  .perf-name {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--color-secondary);
    margin-bottom: 0.3rem;
  }
  .perf-nums {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    font-size: 0.8125rem;
    font-variant-numeric: tabular-nums;
  }
  .perf-nums b { font-size: 1rem; }
  .muted-inline { color: var(--color-secondary); font-size: 0.72rem; align-self: center; }
  .perf-slowest {
    margin-top: 0.3rem;
    font-size: 0.7rem;
    color: var(--color-secondary);
    font-variant-numeric: tabular-nums;
  }
  .perf-route {
    display: inline-block;
    max-width: 14rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: bottom;
    font-family: ui-monospace, monospace;
  }
  .route-perf {
    max-width: 34rem;
    margin-top: 0.5rem;
    font-variant-numeric: tabular-nums;
  }
  .route-perf td:not(.perf-route) { text-align: right; }
  .route-perf th:not(:first-child) { text-align: right; }
  .perf-h3 {
    font-size: 0.8125rem;
    font-weight: 600;
    margin: 0 0 0.5rem;
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
  }
  .geo-country-h {
    margin-top: 1rem;
  }
  .cap-warn {
    margin: 0 0 0.75rem;
    padding: 0.5rem 0.75rem;
    border-radius: 0.375rem;
    background: color-mix(in srgb, var(--danger) 10%, transparent);
    color: var(--danger);
    font-size: 0.8125rem;
  }
  .dev-block + .dev-block,
  .dev-grid {
    margin-top: 1.1rem;
  }
  .dev-grid {
    align-items: start;
  }
  .block-h {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--color-secondary);
    margin-bottom: 0.55rem;
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  .block-h .hint {
    text-transform: none;
    letter-spacing: 0;
    font-weight: 400;
  }
  .lvl { text-transform: uppercase; font-size: 0.6875rem; color: var(--danger); }
  .msg { word-break: break-word; }
  .nowrap { white-space: nowrap; }
  .mono { font-family: var(--font-mono); font-size: 0.75rem; }
  .muted { color: var(--color-secondary); font-size: 0.8125rem; margin: 0; }
  .empty {
    color: var(--color-secondary);
    background: var(--surface);
    border: 1px dashed var(--border-color);
    border-radius: 0.625rem;
    padding: 0.875rem 1rem;
    font-size: 0.8125rem;
    margin: 0;
  }
  @media (max-width: 64rem) {
    .insights { grid-template-columns: repeat(3, 1fr); }
  }
  @media (max-width: 48rem) {
    .cards { grid-template-columns: repeat(2, 1fr); }
    .insights { grid-template-columns: repeat(2, 1fr); }
    .grid { grid-template-columns: 1fr; }
    .perf-summary { grid-template-columns: 1fr; }
  }
</style>
