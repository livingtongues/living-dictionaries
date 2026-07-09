<script lang="ts">
  import type { PageData } from './$types'
  import { ago, country_flag, format_bytes, format_ms, perf_label, short_time, short_version, USERS_COLOR } from '$lib/analytics/dashboard-format'
  import { log_insights } from '$lib/analytics/insights'
  import ComboChart from '$lib/charts/ComboChart.svelte'
  import LineChart from '$lib/charts/LineChart.svelte'
  import VitalBar from '$lib/charts/VitalBar.svelte'
  import { format_number, format_pct } from '$lib/constants'
  import { format_date_time, format_relative_time } from '$lib/utils/format-relative-time'

  interface Props {
    data: Omit<PageData, 'analytics'> & { analytics: NonNullable<Awaited<PageData['analytics']>> }
  }

  let { data }: Props = $props()
  const analytics = $derived(data.analytics)
  const totals = $derived(analytics.totals)
  const daily = $derived(analytics.daily)
  const insights = $derived(log_insights({ analytics }))

  const error_points = $derived(daily.map(point => ({ date: point.day, value: point.errors })))
  /** Known-noise rows (stale-chunk / gated / deploy) folded out of the real-fault headline. */
  const noise_errors = $derived(totals.errors - totals.real_errors)
  // Real faults as the danger area + known noise as a muted line, so a deploy-day
  // stale-chunk burst is visible without reading as a regression.
  const error_series = $derived([
    { label: 'Real errors', color: 'var(--danger)', area: true, points: daily.map(point => ({ date: point.day, value: point.real_errors })) },
    { label: 'Known noise', color: 'var(--text-muted, #94a3b8)', points: daily.map(point => ({ date: point.day, value: point.errors - point.real_errors })) },
    ...(totals.stale_errors > 0
      ? [{ label: 'From stale builds', color: 'var(--color-secondary)', points: daily.map(point => ({ date: point.day, value: point.stale_errors })) }]
      : []),
  ])
  // Deploy markers for the error timeline (app_version = build epoch ms).
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
  const navigation_series = $derived(perf_series('navigation'))
  const search_series = $derived(perf_series('search'))

  const web_vitals = $derived(analytics.web_vitals)

  // "Speed at a glance" — the friendly top-of-page summary of load + nav + paint.
  const perf_by_name = $derived(new Map(perf.summary.map(metric => [metric.name, metric])))
  const page_load_metric = $derived(perf_by_name.get('page_load'))
  const navigation_metric = $derived(perf_by_name.get('navigation'))
  const lcp_vital = $derived(web_vitals.find(vital => vital.metric === 'LCP'))
  function perf_p50_points(name: string) {
    return perf.daily.filter(point => point.metrics[name]?.count).map(point => ({ value: point.metrics[name].p50 }))
  }
  const page_load_spark = $derived(perf_p50_points('page_load'))
  const navigation_spark = $derived(perf_p50_points('navigation'))
  const speed_has_data = $derived((page_load_metric?.count ?? 0) > 0 || (navigation_metric?.count ?? 0) > 0 || (lcp_vital?.count ?? 0) > 0)
  // Axis-less micro-sparkline path (normalized to a 120×32 box) for the speed cards.
  function spark_path(points: { value: number }[], width = 120, height = 30): string {
    if (points.length < 2)
      return ''
    const values = points.map(point => point.value)
    const low = Math.min(...values)
    const range = (Math.max(...values) - low) || 1
    const step = width / (points.length - 1)
    return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${(index * step).toFixed(1)},${(height - ((point.value - low) / range) * height).toFixed(1)}`).join(' ')
  }

  const geo = $derived(analytics.geo)
  const has_geo_latency = $derived(geo.ttfb_by_country.length > 0 || geo.ttfb_by_distance.length > 0)
  const has_lcp_latency = $derived(geo.lcp_by_country.length > 0 || geo.lcp_by_distance.length > 0)

  const pipeline = $derived(analytics.pipeline)
  const server_faults = $derived(analytics.server_faults)
  const errors_by_version = $derived(analytics.errors_by_version)
  const event_coverage = $derived(analytics.event_coverage)
  const clusters = $derived(analytics.error_clusters)
  const leader = $derived(analytics.leader_health)
  const sync_health = $derived(analytics.sync_health)
  const adoption = $derived(analytics.build_adoption)
  const storage = $derived(analytics.storage)
  /** WAL bigger than 2× its DB = wal_checkpoint(TRUNCATE) losing to a pinned reader. */
  const WAL_RATIO_RED = 2
  const wal_red = $derived(storage.dbs.some(row => (row.wal_ratio ?? 0) > WAL_RATIO_RED))
  const boot_health = $derived(analytics.boot_health)
  const boot_non_recovery_pct = $derived(boot_health.non_recovery_pct === null ? null : Math.round(boot_health.non_recovery_pct * 100))
  const boot_points = $derived(boot_health.daily.map(day => ({ date: day.day, value: day.sessions })))

  // Ingestion verdict: distinguishes a broken pipe from a quiet one.
  const ingestion_recent = $derived(!!pipeline.last_log_at && Date.now() - new Date(pipeline.last_log_at).getTime() < 24 * 3600_000)
  // Retention staleness: the cron sweeps every 6h, so a gap past ~13h (2 missed
  // sweeps) means it's wedged — a stuck cron silently stops rolling trends forward.
  const RETENTION_STALE_MS = 13 * 3600_000
  const retention_stale = $derived(!pipeline.retention_ran_at || Date.now() - new Date(pipeline.retention_ran_at).getTime() > RETENTION_STALE_MS)

  const uptime = $derived(analytics.uptime)
  // Healthy when every recorded probe succeeded (or none carried an ok signal).
  const uptime_healthy = $derived(uptime.availability === null || uptime.availability >= 0.99)
  // Days with a TTFB sample — one aligned day list so the two series don't misalign.
  const uptime_days = $derived(uptime.daily.filter(point => point.ttfb_p50 !== null))
  const uptime_ttfb_series = $derived([
    { label: 'p50', color: 'var(--primary)', points: uptime_days.map(point => ({ date: point.day, value: point.ttfb_p50 as number })) },
    { label: 'p95', color: USERS_COLOR, points: uptime_days.map(point => ({ date: point.day, value: point.ttfb_p95 as number })) },
  ])

  const error_suffix = $derived(insights.error_rate != null ? `, ${format_pct(insights.error_rate)} error rate` : '')
  const headline = $derived(
    `${format_number(totals.logs)} logs from ${format_number(totals.unique_users)} users across ${format_number(totals.sessions)} sessions over the last ${analytics.window_days} days${error_suffix}.`,
  )
</script>

<svelte:head><title>Site health · Admin</title></svelte:head>

<div class="analytics">
  <header class="head">
    <h1>Site health</h1>
    <span class="sub">diagnostics · last {analytics.window_days} days · generated {short_time(analytics.generated_at)}</span>
    <a class="health-link" href="/admin/analytics">← Usage analytics</a>
    <div class="audience-toggle" role="group" aria-label="Audience filter">
      <a class="seg" class:active={analytics.audience === 'humans'} href="?audience=humans" data-sveltekit-noscroll>🧑 Humans</a>
      <a class="seg" class:active={analytics.audience === 'bots'} href="?audience=bots" data-sveltekit-noscroll>🤖 Bots</a>
    </div>
  </header>

  {#if analytics.audience === 'bots'}
    <p class="audience-note">🤖 Showing <b>bot / crawler / AI-agent</b> traffic — timings below are bot-only. Diagnostics (errors, build, leader, clusters) always show everyone.</p>
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
      <span class="retention" class:stale={retention_stale}>
        {#if retention_stale}⚠️ {/if}retention {ago(pipeline.retention_ran_at)}
      </span>
    </div>
  </section>

  <section class="cards">
    <div class="card">
      <div class="value" class:danger={totals.real_errors > 0}>{format_number(totals.real_errors)}</div>
      <div class="label">Real errors <span class="card-hint">genuine faults</span></div>
    </div>
    <div class="card">
      <div class="value" class:danger={(insights.error_rate ?? 0) > 0}>{insights.error_rate != null ? format_pct(insights.error_rate) : '—'}</div>
      <div class="label">Error rate <span class="card-hint">real faults ÷ logs</span></div>
    </div>
    <div class="card">
      <div class="value">{format_number(noise_errors)}</div>
      <div class="label">Known noise <span class="card-hint">stale-chunk / gated / expected</span></div>
    </div>
    <div class="card">
      <div class="value">{format_number(totals.stale_errors)}</div>
      <div class="label">From stale builds <span class="card-hint">deploy-day churn</span></div>
    </div>
  </section>

  {#if totals.logs === 0}
    <p class="empty">No log activity in this window yet. Once real traffic lands the charts below
      fill in. The nightly rollup keeps history after raw rows are archived.</p>
  {:else}
    <p class="headline">{headline}</p>
  {/if}

  <section class="panel speed-panel">
    <h2>Speed at a glance <span class="hint">how fast people load &amp; move through the site · p50 &quot;typical&quot; · {analytics.audience === 'bots' ? 'bots' : 'real people, bots excluded'}</span></h2>
    {#if speed_has_data}
      <div class="speed-grid">
        <div class="speed-stat">
          <div class="speed-name">Page load</div>
          <div class="speed-desc">first / hard load (incl. SSR)</div>
          <div class="speed-value">{format_ms(page_load_metric?.p50 ?? null)} <span class="speed-unit">typical</span></div>
          <div class="speed-sub">p95 {format_ms(page_load_metric?.p95 ?? null)} · n={format_number(page_load_metric?.count ?? 0)}</div>
          {#if page_load_spark.length > 1}
            <svg class="spark" viewBox="0 0 120 30" preserveAspectRatio="none" aria-hidden="true"><path d={spark_path(page_load_spark)} fill="none" stroke="var(--primary)" stroke-width="1.5" vector-effect="non-scaling-stroke" /></svg>
          {/if}
        </div>
        <div class="speed-stat">
          <div class="speed-name">In-app navigation</div>
          <div class="speed-desc">home → entry &amp; other SPA moves</div>
          <div class="speed-value">{format_ms(navigation_metric?.p50 ?? null)} <span class="speed-unit">typical</span></div>
          <div class="speed-sub">p95 {format_ms(navigation_metric?.p95 ?? null)} · n={format_number(navigation_metric?.count ?? 0)}</div>
          {#if navigation_spark.length > 1}
            <svg class="spark" viewBox="0 0 120 30" preserveAspectRatio="none" aria-hidden="true"><path d={spark_path(navigation_spark)} fill="none" stroke={USERS_COLOR} stroke-width="1.5" vector-effect="non-scaling-stroke" /></svg>
          {/if}
        </div>
        <div class="speed-stat">
          <div class="speed-name">Largest paint (LCP)</div>
          <div class="speed-desc">when the main content is visible</div>
          <div class="speed-value">{lcp_vital ? format_ms(lcp_vital.p75) : '—'} <span class="speed-unit">p75</span></div>
          <div class="speed-sub">{lcp_vital ? `p50 ${format_ms(lcp_vital.p50)} · n=${format_number(lcp_vital.count)}` : 'no LCP samples yet'}</div>
        </div>
      </div>
    {:else}
      <p class="muted">No speed samples in window yet — page-load, in-app navigation, and LCP timings land here once real sessions arrive.</p>
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
      <details class="rows">
        <summary>Show {format_number(server_faults.clusters.length)} fault class{server_faults.clusters.length === 1 ? '' : 'es'}</summary>
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
      </details>
    {/if}
  </section>

  <section class="panel">
    <h2>Fresh-viewer boot health <span class="hint">dict.db boot cascade · empty-dictionary detector · hot window</span></h2>
    {#if boot_health.failed_sessions === 0}
      <p class="muted">No boot-cascade failures in the hot window. 🎉 Fresh viewers are opening dictionaries cleanly.</p>
    {:else}
      <div class="ver-split">
        <div class="ver-stat">
          <div class="ver-value" class:danger={boot_health.failed_sessions > 0}>{format_number(boot_health.failed_sessions)}</div>
          <div class="ver-label">Failed-boot sessions</div>
          <div class="ver-sub">{format_number(boot_health.recovered_sessions)} later opened an entry</div>
        </div>
        <div class="ver-stat">
          <div class="ver-value" class:danger={(boot_non_recovery_pct ?? 0) >= 50}>{boot_non_recovery_pct === null ? '—' : `${boot_non_recovery_pct}%`}</div>
          <div class="ver-label">Non-recovery rate</div>
          <div class="ver-sub">never rendered any entry after a failed boot</div>
        </div>
        <div class="ver-stat">
          <div class="ver-value" class:danger={boot_health.snapshot_expired_sessions > 0}>{format_number(boot_health.snapshot_expired_sessions)}</div>
          <div class="ver-label">snapshot_expired</div>
          <div class="ver-sub">cursor-vs-snapshot regression fingerprint</div>
        </div>
      </div>
      {#if boot_points.length > 1}
        <LineChart series={boot_points} area color="var(--danger)" height={140} y_format={format_number} tip_format={format_number} />
      {/if}
      <table class="src-table">
        <thead><tr><th>Boot signal</th><th>Code</th><th>Sessions</th><th>Rows</th><th>Last seen</th></tr></thead>
        <tbody>
          {#each boot_health.by_message as row (`${row.message}|${row.code}`)}
            <tr>
              <td>{row.message}</td>
              <td>{row.code ?? '—'}</td>
              <td class:danger={row.sessions > 0}>{format_number(row.sessions)}</td>
              <td>{format_number(row.count)}</td>
              <td>{ago(row.last_seen)}</td>
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
          <div class="ver-stat">
            <div class="ver-value">{errors_by_version.deploy_tail_pct != null ? format_pct(errors_by_version.deploy_tail_pct) : '—'}</div>
            <div class="ver-label">Deploy-settling</div>
            <div class="ver-sub">{format_number(errors_by_version.deploy_tail_errors)} within {30}min of a build's first appearance — churn, not a regression</div>
          </div>
        </div>
        <details class="rows">
          <summary>Show {format_number(errors_by_version.versions.length)} build{errors_by_version.versions.length === 1 ? '' : 's'}</summary>
          <table class="src-table">
            <thead><tr><th>Build</th><th>Errors</th></tr></thead>
            <tbody>
              {#each errors_by_version.versions as row (row.version)}
                <tr><td>{short_version(row.version)}{row.is_current ? ' (current)' : ''}</td><td class:danger={!row.is_current}>{format_number(row.errors)}</td></tr>
              {/each}
            </tbody>
          </table>
        </details>
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
    <h2>Build adoption <span class="hint">active sessions (last 24h) by build age · who's stranded on un-fixable old code</span></h2>
    {#if adoption.total === 0}
      <p class="muted">No active sessions in the last 24h.</p>
    {:else}
      <div class="ver-split">
        <div class="ver-stat">
          <div class="ver-value" class:danger={adoption.stale > 0}>{adoption.stranded_pct != null ? format_pct(adoption.stranded_pct) : '—'}</div>
          <div class="ver-label">of active sessions can't receive fixes</div>
          <div class="ver-sub">{format_number(adoption.behind + adoption.stale)} of {format_number(adoption.current + adoption.behind + adoption.stale)} on a non-current build</div>
        </div>
        <div class="ver-stat">
          <div class="ver-value">{format_number(adoption.current)}</div>
          <div class="ver-label">On the current build</div>
          <div class="ver-sub">{format_number(adoption.behind)} 1–2 days behind{adoption.unknown > 0 ? ` · ${format_number(adoption.unknown)} unknown build` : ''}</div>
        </div>
        <div class="ver-stat">
          <div class="ver-value" class:danger={adoption.stale > 0}>{format_number(adoption.stale)}</div>
          <div class="ver-label">Stranded (≥3 days stale)</div>
          <div class="ver-sub">stuck until a hard reload — nudge the named users</div>
        </div>
      </div>
      <table class="src-table">
        <thead><tr><th>Build</th><th>Age</th><th>Sessions</th><th>Signed-in users</th><th>Last seen</th></tr></thead>
        <tbody>
          {#each adoption.builds as row (row.app_version)}
            <tr>
              <td class="mono">{short_version(row.app_version)}{row.is_current ? ' (current)' : ''}</td>
              <td class:danger={(row.age_days ?? 0) >= 3 && !row.is_current}>{row.age_days != null ? `${row.age_days}d` : '—'}</td>
              <td>{format_number(row.sessions)}</td>
              <td>{row.users.length ? row.users.join(', ') : '—'}</td>
              <td class="nowrap">{ago(row.last_seen)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>

  <section class="panel">
    <h2>Sync health <span class="hint">sync_failed family · client_behind storm detector · warn-level · hot window</span></h2>
    {#if sync_health.total === 0}
      <p class="muted">No sync failures in the hot window. 🎉 Every client is in step with the server schema.</p>
    {:else}
      <div class="ver-split">
        <div class="ver-stat">
          <div class="ver-value" class:danger={sync_health.client_behind.current > 0}>{format_number(sync_health.client_behind.current)}</div>
          <div class="ver-label">client_behind on current build</div>
          <div class="ver-sub">should stay ~0 post-fix — a spike = a new retry storm</div>
        </div>
        <div class="ver-stat">
          <div class="ver-value">{format_number(sync_health.client_behind.stale)}</div>
          <div class="ver-label">client_behind on stale builds</div>
          <div class="ver-sub">residual from tabs a deploy can't reach (reload to clear)</div>
        </div>
        <div class="ver-stat">
          <div class="ver-value" class:danger={sync_health.stuck_pairs > 0}>{format_number(sync_health.stuck_pairs)}</div>
          <div class="ver-label">Tabs still stuck</div>
          <div class="ver-sub">
            distinct (user, dict){#if sync_health.oldest_unresolved_at} · oldest {ago(sync_health.oldest_unresolved_at)}{/if}
          </div>
        </div>
      </div>
      <div class="grid">
        <table class="src-table">
          <thead><tr><th>Failure kind</th><th>Current</th><th>Stale</th><th>Total</th></tr></thead>
          <tbody>
            {#each sync_health.by_kind as row (row.kind)}
              <tr>
                <td>{row.kind}</td>
                <td class:danger={row.kind === 'client_behind' && row.current > 0}>{format_number(row.current)}</td>
                <td>{format_number(row.stale)}</td>
                <td><b>{format_number(row.count)}</b></td>
              </tr>
            {/each}
          </tbody>
        </table>
        {#if sync_health.stuck.length}
          <details class="rows">
            <summary>Show {format_number(sync_health.stuck.length)} stuck tab{sync_health.stuck.length === 1 ? '' : 's'}</summary>
            <table class="src-table stuck-table">
              <thead><tr><th>Stuck tab (user · dict)</th><th>Build</th><th>Last</th><th>Rows</th></tr></thead>
              <tbody>
                {#each sync_health.stuck as row (`${row.user_id}|${row.dict_id}`)}
                  <tr>
                    <td>{row.user_id ?? 'anon'} · {row.dict_id ?? '—'}</td>
                    <td class="mono">{short_version(row.app_version)}</td>
                    <td class="nowrap">{ago(row.last_seen)}</td>
                    <td>{format_number(row.count)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </details>
        {/if}
      </div>
    {/if}
  </section>

  <section class="panel">
    <h2>Storage · WAL <span class="hint">server DB files · red = WAL &gt; {WAL_RATIO_RED}× DB (checkpoint losing to a pinned reader)</span></h2>
    {#if storage.dbs.length > 0 || storage.dict_dbs}
      <table class="src-table">
        <thead><tr><th>DB</th><th>Size</th><th>WAL</th><th>Ratio</th></tr></thead>
        <tbody>
          {#each storage.dbs as row (row.name)}
            <tr>
              <td class="mono">{row.name}</td>
              <td>{format_bytes(row.db_bytes)}</td>
              <td class:danger={(row.wal_ratio ?? 0) > WAL_RATIO_RED}>{format_bytes(row.wal_bytes)}</td>
              <td class:danger={(row.wal_ratio ?? 0) > WAL_RATIO_RED}>{row.wal_ratio != null ? `${row.wal_ratio.toFixed(row.wal_ratio >= 10 ? 0 : 1)}×` : '—'}</td>
            </tr>
          {/each}
          {#if storage.dict_dbs}
            <tr>
              <td class="mono">dictionaries/*.db · {format_number(storage.dict_dbs.count)} file{storage.dict_dbs.count === 1 ? '' : 's'}</td>
              <td>{format_bytes(storage.dict_dbs.db_bytes)}</td>
              <td>{format_bytes(storage.dict_dbs.wal_bytes)}</td>
              <td>—</td>
            </tr>
          {/if}
        </tbody>
      </table>
      {#if wal_red}
        <p class="muted">⚠️ A WAL over {WAL_RATIO_RED}× its DB means <code>wal_checkpoint(TRUNCATE)</code> keeps losing to a pinned reader — a checkpoint regression, not normal growth.</p>
      {/if}
    {:else}
      <p class="muted">No DB files on disk to measure (in-memory / dev).</p>
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
        {#if navigation_series[0].points.length}
          <div>
            <h3 class="perf-h3">In-app navigation <span class="hint">ms · SPA nav duration</span></h3>
            <ComboChart series={navigation_series} height={180} value_format={format_ms} />
          </div>
        {/if}
        {#if search_series[0].points.length}
          <div>
            <h3 class="perf-h3">Search <span class="hint">ms</span></h3>
            <ComboChart series={search_series} height={180} value_format={format_ms} />
          </div>
        {/if}
      </div>
      <div class="grid route-grid">
        {#if perf.by_route.length}
          <div>
            <h3 class="perf-h3">Page load by route <span class="hint">slowest p95 first · ms</span></h3>
            <table class="route-perf">
              <thead><tr><th>Route</th><th>p50</th><th>p95</th><th>max</th><th>n</th></tr></thead>
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
          </div>
        {/if}
        {#if perf.nav_by_route.length}
          <div>
            <h3 class="perf-h3">Navigation by destination <span class="hint">most-travelled first · ms</span></h3>
            <table class="route-perf">
              <thead><tr><th>Destination</th><th>p50</th><th>p95</th><th>max</th><th>n</th></tr></thead>
              <tbody>
                {#each perf.nav_by_route as row (row.route)}
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
          </div>
        {/if}
      </div>
      {#if perf.lcp_by_route.length}
        <h3 class="perf-h3">LCP by landing route <span class="hint">largest contentful paint · most-sampled first · ms</span></h3>
        <table class="route-perf">
          <thead><tr><th>Route</th><th>p50</th><th>p95</th><th>max</th><th>n</th></tr></thead>
          <tbody>
            {#each perf.lcp_by_route as row (row.route)}
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
    <h2>Synthetic uptime <span class="hint">off-box probe · availability + fixed-vantage latency · hot window</span></h2>
    {#if uptime.probes > 0}
      <p class="uptime-verdict" class:ok={uptime_healthy} class:danger={!uptime_healthy}>
        {#if uptime.availability !== null}
          {format_pct(uptime.availability)} availability
        {:else}
          availability n/a
        {/if}
        <span class="hint">· {format_number(uptime.probes)} probe{uptime.probes === 1 ? '' : 's'}{#if uptime.vantages.length} · from {uptime.vantages.join(', ')}{/if}</span>
      </p>
      <p class="cap-hint">A probe only records when <code>/api/log</code> (same origin) is reachable, so availability is the success rate of recorded probes — a full outage self-suppresses. The latency trend is the primary signal.</p>
      <div class="perf-summary uptime-summary">
        <div class="perf-stat">
          <div class="perf-name">Server TTFB</div>
          <div class="perf-nums">
            <span><b>{format_ms(uptime.ttfb.p50 ?? 0)}</b> p50</span>
            <span><b>{format_ms(uptime.ttfb.p95 ?? 0)}</b> p95</span>
          </div>
        </div>
        <div class="perf-stat">
          <div class="perf-name">Total response</div>
          <div class="perf-nums">
            <span><b>{format_ms(uptime.total.p50 ?? 0)}</b> p50</span>
            <span><b>{format_ms(uptime.total.p95 ?? 0)}</b> p95</span>
          </div>
        </div>
      </div>
      {#if uptime_ttfb_series[0].points.length}
        <h3 class="perf-h3">Server TTFB <span class="hint">ms · fixed vantage · p50 / p95</span></h3>
        <ComboChart series={uptime_ttfb_series} height={180} value_format={format_ms} />
      {/if}
    {:else}
      <p class="muted">No synthetic probe data in window. An off-box monitor (the mustang uptime prober) POSTs <code>uptime_probe</code> availability + latency samples here every few minutes.</p>
    {/if}
  </section>

  <section class="panel">
    <h2>Core Web Vitals <span class="hint">graded on the typical (75th-percentile) visit · recent traffic · {analytics.audience === 'bots' ? 'bots' : 'real people, bots excluded'}</span></h2>
    {#if web_vitals.length}
      <div class="vitals">
        {#each web_vitals as vital (vital.metric)}
          <VitalBar {vital} />
        {/each}
      </div>
    {:else if totals.sessions > 0}
      <p class="muted">No Web Vitals landed despite {format_number(totals.sessions)} session{totals.sessions === 1 ? '' : 's'}. FCP/TTFB report on load; LCP/INP/CLS only finalize on real interaction or page-hide — so short or automated sessions may never flush them. If this stays empty under genuine traffic, verify <code>init_web_vitals()</code>.</p>
    {:else}
      <p class="muted">No Web Vitals in window yet. LCP, INP, CLS, FCP and TTFB appear here once real sessions land.</p>
    {/if}
  </section>

  <section class="panel">
    <h2>Latency by geography <span class="hint">TTFB · p50 / p95 · hot window · {format_number(geo.located_sessions)} located sessions</span></h2>
    {#if has_geo_latency}
      <div class="grid">
        <div>
          <h3 class="perf-h3">TTFB by distance to Boston <span class="hint">p50 / p95</span></h3>
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
        <div>
          <h3 class="perf-h3">TTFB by country <span class="hint">p50 / p95</span></h3>
          {#if geo.ttfb_by_country.length}
            <table class="src-table">
              <thead><tr><th>Country</th><th>p50</th><th>p95</th><th>n</th></tr></thead>
              <tbody>
                {#each geo.ttfb_by_country as row (row.label)}
                  <tr><td>{country_flag(row.label)} {row.label}</td><td>{format_ms(row.p50 ?? 0)}</td><td>{format_ms(row.p95 ?? 0)}</td><td>{format_number(row.count)}</td></tr>
                {/each}
              </tbody>
            </table>
          {:else}
            <p class="muted">No located TTFB samples yet.</p>
          {/if}
        </div>
      </div>
      {#if has_lcp_latency}
        <div class="grid lcp-grid">
          <div>
            <h3 class="perf-h3">LCP by distance to Boston <span class="hint">p50 / p95 · far-region cold-snapshot tail</span></h3>
            {#if geo.lcp_by_distance.length}
              <table class="src-table">
                <thead><tr><th>Distance</th><th>p50</th><th>p95</th><th>n</th></tr></thead>
                <tbody>
                  {#each geo.lcp_by_distance as row (row.label)}
                    <tr><td>{row.label}</td><td>{format_ms(row.p50 ?? 0)}</td><td>{format_ms(row.p95 ?? 0)}</td><td>{format_number(row.count)}</td></tr>
                  {/each}
                </tbody>
              </table>
            {:else}
              <p class="muted">No coordinates for LCP yet — needs the CF location-headers transform.</p>
            {/if}
          </div>
          <div>
            <h3 class="perf-h3">LCP by country <span class="hint">p50 / p95</span></h3>
            {#if geo.lcp_by_country.length}
              <table class="src-table">
                <thead><tr><th>Country</th><th>p50</th><th>p95</th><th>n</th></tr></thead>
                <tbody>
                  {#each geo.lcp_by_country as row (row.label)}
                    <tr><td>{country_flag(row.label)} {row.label}</td><td>{format_ms(row.p50 ?? 0)}</td><td>{format_ms(row.p95 ?? 0)}</td><td>{format_number(row.count)}</td></tr>
                  {/each}
                </tbody>
              </table>
            {:else}
              <p class="muted">No located LCP samples yet.</p>
            {/if}
          </div>
        </div>
      {/if}
    {:else}
      <p class="muted">No geo-located TTFB samples in window yet. Country arrives once real traffic lands; the distance-to-Boston split needs the Cloudflare “Add visitor location headers” managed transform enabled.</p>
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
    <h2>Error clusters <span class="hint">grouped by message + stack · hot window · all traffic · known-noise sunk</span></h2>
    {#if clusters.length === 0}
      <p class="muted">No errors recorded. 🎉</p>
    {:else}
      <details class="rows">
        <summary>Show {format_number(clusters.length)} error cluster{clusters.length === 1 ? '' : 's'}</summary>
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
      </details>
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
  .health-link {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--primary);
    text-decoration: none;
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
  .pipeline-stats .retention.stale {
    color: var(--warning, #d97706);
    font-weight: 600;
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
    /* A many-column diagnostic table's min-content can exceed a phone's width;
       scroll it locally instead of pushing the whole page into a sideways
       scroll (responsive-table pattern — the block box scrolls, the rows still
       lay out as a table inside it). */
    display: block;
    overflow-x: auto;
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
  .stuck-table { max-width: 30rem; }
  .lcp-grid { margin-top: 1rem; }
  .speed-panel {
    border-left: 3px solid var(--primary);
  }
  .speed-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.75rem;
  }
  .speed-stat {
    border: 1px solid var(--border-color);
    border-radius: 0.5rem;
    padding: 0.75rem 0.875rem;
    display: flex;
    flex-direction: column;
  }
  .speed-name {
    font-size: 0.85rem;
    font-weight: 700;
  }
  .speed-desc {
    font-size: 0.7rem;
    color: var(--color-secondary);
    margin-bottom: 0.4rem;
  }
  .speed-value {
    font-size: 1.75rem;
    font-weight: 700;
    line-height: 1.05;
    font-variant-numeric: tabular-nums;
  }
  .speed-unit {
    font-size: 0.7rem;
    font-weight: 500;
    color: var(--color-secondary);
  }
  .speed-sub {
    font-size: 0.72rem;
    color: var(--color-secondary);
    margin-top: 0.2rem;
    font-variant-numeric: tabular-nums;
  }
  .spark {
    width: 100%;
    height: 30px;
    margin-top: auto;
    padding-top: 0.5rem;
    display: block;
    overflow: visible;
  }
  .route-grid { margin-top: 0.5rem; }
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
  .cap-warn {
    margin: 0 0 0.75rem;
    padding: 0.5rem 0.75rem;
    border-radius: 0.375rem;
    background: color-mix(in srgb, var(--danger) 10%, transparent);
    color: var(--danger);
    font-size: 0.8125rem;
  }
  .cap-hint {
    margin: 0.75rem 0 0;
    font-size: 0.78rem;
    color: var(--color-secondary);
  }
  .cap-hint code, .muted code { font-family: var(--font-mono); font-size: 0.72rem; }
  .uptime-verdict {
    margin: 0 0 0.5rem;
    font-size: 1.125rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .uptime-verdict.ok { color: var(--success, #16a34a); }
  .uptime-verdict.danger { color: var(--danger); }
  .uptime-verdict .hint { font-weight: 400; }
  .uptime-summary { grid-template-columns: repeat(2, minmax(0, 12rem)); }
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
  @media (max-width: 48rem) {
    .cards { grid-template-columns: repeat(2, 1fr); }
    .grid { grid-template-columns: 1fr; }
    .perf-summary { grid-template-columns: 1fr; }
    .speed-grid { grid-template-columns: 1fr; }
  }
  /* Collapse long error/row lists behind a toggle — the verdict/stat cards above
     stay visible, the raw rows are opt-in (mirrors house's HealthView). */
  .rows { margin-top: 0.6rem; }
  .rows > summary {
    cursor: pointer;
    list-style: none;
    color: var(--color-secondary);
    font-size: 0.78rem;
    font-weight: 600;
    padding: 0.25rem 0;
  }
  .rows > summary::-webkit-details-marker { display: none; }
  .rows > summary::before { content: '▸ '; }
  .rows[open] > summary::before { content: '▾ '; }
  .rows > summary:hover { color: var(--color); }
</style>
