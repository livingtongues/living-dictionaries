<script lang="ts">
  import type { PageData } from './$types'
  import { log_insights } from '$lib/analytics/insights'
  import BarChart from '$lib/charts/BarChart.svelte'
  import ComboChart from '$lib/charts/ComboChart.svelte'
  import LineChart from '$lib/charts/LineChart.svelte'
  import { format_number, format_pct } from '$lib/constants'

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
  const route_bars = $derived(analytics.top_routes.map(row => ({ label: row.route, value: row.count })))
  const event_bars = $derived(analytics.top_events.map(row => ({ label: row.event, value: row.count, color: USERS_COLOR })))
  const browser_bars = $derived(analytics.browsers.map(row => ({
    label: row.os && row.os !== 'Other' ? `${row.label} · ${row.os}` : row.label,
    value: row.sessions,
    color: row.below_capability ? 'var(--danger)' : undefined,
  })))
  const capability = $derived(analytics.capability)
  const below_pct = $derived(capability.total_sessions > 0 ? capability.below_capability_sessions / capability.total_sessions : 0)

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

  const geo = $derived(analytics.geo)
  const has_geo = $derived(geo.areas.length > 0 || geo.ttfb_by_country.length > 0 || geo.ttfb_by_distance.length > 0)
  // Country code → flag emoji (regional-indicator pair). Non-ISO sentinels (XX/T1) fall back to a globe.
  function country_flag(code: string): string {
    if (!/^[A-Z]{2}$/i.test(code) || code.toUpperCase() === 'XX')
      return '🌐'
    return String.fromCodePoint(...[...code.toUpperCase()].map(ch => 0x1F1E6 + ch.charCodeAt(0) - 65))
  }
  const area_bars = $derived(geo.areas.map(area => ({ label: `${country_flag(area.country)} ${area.key}`, value: area.sessions })))

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
  </header>

  <section class="cards">
    {#each [['Sessions', analytics.totals.sessions], ['Unique users', analytics.totals.unique_users], ['Errors', analytics.totals.errors], ['Log rows', analytics.totals.logs]] as [label, value] (label)}
      <div class="card">
        <div class="value" class:danger={label === 'Errors' && Number(value) > 0}>{format_number(Number(value))}</div>
        <div class="label">{label}</div>
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
      <div class="insight-sub">errors ÷ logs</div>
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
      <ComboChart series={traffic_series} height={200} value_format={format_number} />
    {:else}
      <p class="muted">No sessions logged yet.</p>
    {/if}
  </section>

  <section class="panel">
    <h2>Errors per day</h2>
    {#if totals.errors > 0}
      <LineChart series={error_points} area color="var(--danger)" height={200} y_format={format_number} tip_format={format_number} />
    {:else}
      <p class="muted">No errors recorded. 🎉</p>
    {/if}
  </section>

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
    {:else}
      <p class="muted">No performance timings in window yet. Page-load, viewer-boot, and search timings appear here.</p>
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
      <h2>Top routes</h2>
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
    <h2>Browsers &amp; device capability <span class="hint">human sessions, last {analytics.window_days}d{capability.bot_sessions > 0 ? ` · ${format_number(capability.bot_sessions)} bot sessions excluded` : ''}</span></h2>
    {#if capability.below_capability_sessions > 0}
      <p class="cap-warn">
        ⚠️ {format_number(capability.below_capability_sessions)} of {format_number(capability.total_sessions)} sessions ({format_pct(below_pct)}) are on a browser that can't run the local-first DB worker (Safari &lt; 15.4) — they fall back to main-thread IndexedDB or SSR.
      </p>
    {/if}
    <div class="grid">
      <div>
        {#if browser_bars.length}
          <BarChart data={browser_bars} format={format_number} label_width={150} />
        {:else}
          <p class="muted">No sessions in window.</p>
        {/if}
      </div>
      <div>
        <table class="src-table">
          <thead><tr><th>Local-DB tier</th><th>Sessions</th></tr></thead>
          <tbody>
            {#each capability.db_tiers as row (row.tier)}
              <tr><td>{row.tier}</td><td>{format_number(row.sessions)}</td></tr>
            {:else}
              <tr><td colspan="2" class="muted">No sessions in window.</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <section class="panel">
    <h2>Recent errors</h2>
    {#if analytics.recent_errors.length === 0}
      <p class="muted">No errors recorded. 🎉</p>
    {:else}
      <table class="err-table">
        <thead><tr><th>When</th><th>Lvl</th><th>Src</th><th>Message</th></tr></thead>
        <tbody>
          {#each analytics.recent_errors as row (row.id)}
            <tr>
              <td class="nowrap mono">{short_time(row.received_at)}</td>
              <td class="lvl">{row.level}</td>
              <td>{row.source ?? 'client'}</td>
              <td class="msg" title={row.url ?? ''}>{row.message}</td>
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
  .card .label {
    color: var(--color-secondary);
    font-size: 0.75rem;
    margin-top: 0.25rem;
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
