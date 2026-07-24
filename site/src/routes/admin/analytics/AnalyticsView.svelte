<script lang="ts">
  import type { PageData } from './$types'
  import { BROWSER_COLORS, country_flag, db_tier_color, DEVICE_META, one_decimal, OS_COLORS, USERS_COLOR } from '$lib/analytics/dashboard-format'
  import { get_locale_display_name } from '$lib/i18n/locales'
  import { log_insights } from '$lib/analytics/insights'
  import AtAGlance from '$lib/analytics/AtAGlance.svelte'
  import type { DonutDatum } from '$lib/charts/DonutChart.svelte'
  import type { Segment } from '$lib/charts/SegmentedBar.svelte'
  import BarChart from '$lib/charts/BarChart.svelte'
  import ComboChart from '$lib/charts/ComboChart.svelte'
  import DonutChart from '$lib/charts/DonutChart.svelte'
  import LineChart from '$lib/charts/LineChart.svelte'
  import SegmentedBar from '$lib/charts/SegmentedBar.svelte'
  import { format_number, format_pct } from '$lib/constants'
  import { format_date_time, format_relative_time } from '$lib/utils/format-relative-time'

  interface Props {
    data: Omit<PageData, 'primary' | 'secondary'> & { analytics: NonNullable<Awaited<PageData['secondary']>> }
  }

  let { data }: Props = $props()
  const analytics = $derived(data.analytics)
  const totals = $derived(analytics.totals)
  const daily = $derived(analytics.daily)
  const insights = $derived(log_insights({ analytics }))

  const is_bots = $derived(analytics.audience === 'bots')
  const has_traffic = $derived(totals.sessions > 0 || totals.unique_users > 0)

  // Bots have no signed-in "users" — drop the (always-0) Users line for that audience.
  const traffic_series = $derived([
    { label: 'Sessions', color: 'var(--primary)', points: daily.map(point => ({ date: point.day, value: point.sessions })) },
    ...(is_bots ? [] : [{ label: 'Users', color: USERS_COLOR, points: daily.map(point => ({ date: point.day, value: point.users })) }]),
  ])
  // Deploy markers for the traffic timeline: a vertical chip per build
  // (app_version = build epoch ms), so a spike pins to the deploy that caused it.
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

  // --- Entry edits by channel — watch the UI→agent-API transition. ---
  const entry_edits = $derived(analytics.entry_edits)
  const entry_edit_series = $derived([
    { label: 'UI', color: 'var(--primary)', points: entry_edits.daily.map(point => ({ date: point.day, value: point.ui })) },
    { label: 'Agent API', color: '#7c3aed', points: entry_edits.daily.map(point => ({ date: point.day, value: point.api })) },
  ])

  const capability = $derived(analytics.capability)
  const below_pct = $derived(capability.total_sessions > 0 ? capability.below_capability_sessions / capability.total_sessions : 0)

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

  const geo = $derived(analytics.geo)
  const area_bars = $derived(geo.areas.map(area => ({ label: `${country_flag(area.country)} ${area.key}`, value: area.sessions })))

  // --- Languages: browser preference (supported or not) vs UI language in use. ---
  const locales_data = $derived(analytics.locales)
  const UNSUPPORTED_COLOR = '#f59e0b'
  /** English display name for any language tag (Intl covers the unsupported ones). */
  function locale_label(locale: string): string {
    let name = get_locale_display_name(locale)
    if (name === locale) {
      try {
        name = new Intl.DisplayNames(['en'], { type: 'language' }).of(locale) ?? locale
      } catch { /* garbage tag — show the code */ }
    }
    return name === locale ? locale : `${name} · ${locale}`
  }
  const browser_locale_bars = $derived(locales_data.browser.map(row => ({
    label: `${row.supported ? '' : '✳ '}${locale_label(row.locale)}`,
    value: row.visitors,
    ...(row.supported ? {} : { color: UNSUPPORTED_COLOR }),
  })))
  const in_use_bars = $derived(locales_data.in_use.map(row => ({ label: locale_label(row.locale), value: row.visitors, color: USERS_COLOR })))
  const mismatch_bars = $derived(locales_data.mismatch.map(row => ({ label: locale_label(row.locale), value: row.visitors, color: UNSUPPORTED_COLOR })))

  // SWR cache means the payload can be hours old — say so plainly ("show us what's cached").
  const data_age = $derived(format_relative_time(analytics.generated_at))

  // Per-dictionary unique visitors — rolling 30d + previous month + live 7d.
  const top_dictionaries = $derived(analytics.top_dictionaries)
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  /** 'YYYY-MM' → 'Mon' (short label for column headers / stats). */
  function month_label(month: string): string {
    const [, mon] = month.split('-').map(Number)
    return MONTH_NAMES[(mon ?? 1) - 1] ?? month
  }
</script>

<svelte:head><title>Analytics · Admin</title></svelte:head>

<div class="analytics">
  <header class="head">
    <h1>Analytics</h1>
    <span class="sub" title={format_date_time(analytics.generated_at)}>usage · last {analytics.window_days} days · <b>data computed {data_age}</b> (cached; refreshes in the background)</span>
    <div class="audience-toggle" role="group" aria-label="Audience filter">
      <a class="seg" class:active={analytics.audience === 'humans'} href="?audience=humans" data-sveltekit-noscroll>🧑 Humans</a>
      <a class="seg" class:active={analytics.audience === 'bots'} href="?audience=bots" data-sveltekit-noscroll>🤖 Bots</a>
    </div>
  </header>

  {#if analytics.audience === 'bots'}
    <p class="audience-note">🤖 Showing <b>bot / crawler / AI-agent</b> traffic — usage, routes, events and geo below are bot-only. Diagnostics (errors, build, leader, clusters) live on <a href="/admin/health">Site health</a>.</p>
  {:else}
    <AtAGlance {analytics} show_attention={false} />
  {/if}

  <section class="cards">
    {#each is_bots ? [['Sessions', analytics.totals.sessions]] : [['Sessions', analytics.totals.sessions], ['Unique users', analytics.totals.unique_users]] as [label, value] (label)}
      <div class="card">
        <div class="value">{format_number(Number(value))}</div>
        <div class="label">{label}</div>
      </div>
    {/each}
  </section>

  <section class="insights">
    <div class="insight">
      <div class="insight-value">{one_decimal(insights.sessions_per_day)}</div>
      <div class="insight-label">Sessions / day</div>
      <div class="insight-sub">avg over {analytics.window_days}d</div>
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
    <h2>Traffic <span class="hint">sessions vs unique users · ⬆ = deploy</span></h2>
    {#if has_traffic}
      <ComboChart series={traffic_series} events={deploy_events} event_icon="⬆" height={200} value_format={format_number} />
    {:else}
      <p class="muted">No sessions yet.</p>
    {/if}
  </section>

  <div class="grid">
    <section class="panel">
      <h2>Top routes <span class="hint">{routes_have_sessions ? 'by distinct sessions' : 'by nav count (archived days only)'}</span></h2>
      {#if route_bars.length}
        <BarChart data={route_bars} format={format_number} label_width={132} />
      {:else}
        <p class="muted">No navigation yet.</p>
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

  {#if !is_bots}
    <section class="panel">
      <h2>Top dictionaries by unique visitors <span class="hint">distinct {analytics.audience === 'bots' ? 'bot' : 'human'} visitors (cookieless <code>visitor_id</code>) · anonymous ≈ outside public</span></h2>
      {#if top_dictionaries.dictionaries.length}
        <div class="ver-split">
          <div class="ver-stat">
            <div class="ver-value">{format_number(top_dictionaries.site_visitors_30d)}</div>
            <div class="ver-label">Site visitors · last 30d</div>
            <div class="ver-sub">{format_number(top_dictionaries.site_visitors_prev_month)} in {month_label(top_dictionaries.prev_month)} · {format_number(top_dictionaries.site_visitors_7d)} in 7d</div>
          </div>
          <div class="ver-stat">
            <div class="ver-value">{format_number(top_dictionaries.distinct_dictionaries)}</div>
            <div class="ver-label">Dictionaries with visitors</div>
            <div class="ver-sub">in the last 30 days</div>
          </div>
        </div>
        <table class="dict-table">
          <thead><tr><th>Dictionary</th><th title="TRUE unique visitors over the rolling last 30 days">Visitors 30d</th><th title="unique visitors last complete month">{month_label(top_dictionaries.prev_month)}</th><th title="unique visitors, rolling last 7 days">7d</th><th title="distinct sessions/visits over 30d (activity)">Visits 30d</th><th title="anonymous (logged-out) share of the last 30 days' visitors ≈ outside public">Anon</th></tr></thead>
          <tbody>
            {#each top_dictionaries.dictionaries as row (row.dictionary_id)}
              <tr>
                <td class="dict-name">
                  {#if row.url}<a href={`/${row.url}`}>{row.name ?? row.url}</a>{:else}{row.name ?? row.dictionary_id}{/if}
                  {#if !row.is_public}<span class="unlisted">(unlisted)</span>{/if}
                </td>
                <td class="num"><b>{row.visitors_30d ? format_number(row.visitors_30d) : '—'}</b></td>
                <td class="num">{row.visitors_prev_month ? format_number(row.visitors_prev_month) : '—'}</td>
                <td class="num">{row.visitors_7d ? format_number(row.visitors_7d) : '—'}</td>
                <td class="num">{format_number(row.visits_30d)}</td>
                <td class="num anon">{row.visitors_30d ? format_pct(row.anon_visitors_30d / row.visitors_30d) : '—'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        <p class="dict-note"><b>Visitors</b> = distinct persistent <code>visitor_id</code>s (one per browser/device, cookieless localStorage) — a true unique count, computed as a UNION over the whole period (NOT daily-distinct "visitor-days"). <b>30d</b> is the rolling last 30 days; the named month is the previous complete calendar month; <b>7d</b> is the shorter rolling view; <b>Visits 30d</b> counts sessions (resets per page-load) for activity context. "Visitors" means distinct browsers, not humans (a shared device → one; a person across devices → several). Populating from 2026-07-07 onward (reads low until 30 days of history builds). Bots excluded.</p>
      {:else}
        <p class="muted">No dictionary visitors in the last 30 days.</p>
      {/if}
    </section>
  {/if}

  {#if !is_bots}
    <section class="panel">
      <h2>Browsers &amp; devices <span class="hint">human sessions, last {analytics.window_days}d{capability.bot_sessions > 0 ? ` · ${format_number(capability.bot_sessions)} bot sessions excluded${capability.webdriver_sessions > 0 ? ` (${format_number(capability.webdriver_sessions)} automated)` : ''}` : ''}</span></h2>
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
  {/if}

  <section class="panel">
    <h2>Geography <span class="hint">{format_number(geo.located_sessions)} located {is_bots ? 'bot ' : ''}sessions (visits, not unique people) by region · {is_bots ? '' : 'admins excluded · '}approximate (Cloudflare edge) · latency splits on <a href="/admin/health">Site health</a></span></h2>
    {#if area_bars.length}
      <BarChart data={area_bars} format={format_number} label_width={120} />
    {:else}
      <p class="muted">No geolocated sessions in window yet. Country arrives once real traffic lands (needs the Cloudflare “Add visitor location headers” managed transform).</p>
    {/if}
  </section>

  {#if !is_bots}
    <section class="panel">
      <h2>Languages <span class="hint">unique visitors · browser preference vs UI language used · admins excluded · ✳ = not yet supported</span></h2>
      {#if locales_data.sessions_with_browser_locale === 0 && locales_data.sessions_with_ui_locale === 0}
        <p class="muted">No locale data yet — tracking starts with the 2026-07-24 deploy (browser preference from <code>Accept-Language</code>; in-use locale from <code>session_start</code>). Reads low until the window fills.</p>
      {:else}
        {#if locales_data.mismatch_visitors > 0}
          <p class="cap-warn">
            ⚠️ {format_number(locales_data.mismatch_visitors)} visitors' browsers prefer a language we already support, but their sessions ran in English — bad translation, or they never found the language switcher.
          </p>
        {/if}
        <div class="grid dev-grid">
          <div class="dev-block">
            <div class="block-h">Browser preference <span class="hint">what visitors' browsers ask for, supported or not</span></div>
            {#if browser_locale_bars.length}
              <BarChart data={browser_locale_bars} format={format_number} label_width={172} />
            {:else}
              <p class="muted">No browser-locale data in window.</p>
            {/if}
          </div>
          <div class="dev-block">
            <div class="block-h">Language in use <span class="hint">what the UI actually rendered in</span></div>
            {#if in_use_bars.length}
              <BarChart data={in_use_bars} format={format_number} label_width={172} />
            {:else}
              <p class="muted">No in-use locale data in window.</p>
            {/if}
          </div>
        </div>
        <div class="grid dev-grid">
          {#if mismatch_bars.length}
            <div class="dev-block">
              <div class="block-h">Supported but unused <span class="hint">browser prefers it · session ran in English</span></div>
              <BarChart data={mismatch_bars} format={format_number} label_width={172} />
            </div>
          {/if}
          <p class="muted">Amber ✳ languages are the "should we add this?" ranking — visitors whose browsers prefer a language the UI doesn't offer. Coverage: {format_number(locales_data.sessions_with_browser_locale)} sessions carried a browser locale, {format_number(locales_data.sessions_with_ui_locale)} an in-use locale (both populate from 2026-07-24 onward). Regional variants fold together (pt-BR → pt) except the two Chinese scripts.</p>
        </div>
      {/if}
    </section>

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
      <h2>Entry edits · UI vs Agent API <span class="hint">creates/updates/deletes per day · forever rollup + live tail</span></h2>
      {#if entry_edits.ui_total === 0 && entry_edits.api_total === 0}
        <p class="muted">No entry edits in this window yet. Human editing-UI events and /api/v1 agent writes both land here.</p>
      {:else}
        <div class="ver-split">
          <div class="ver-stat">
            <div class="ver-value">{format_number(entry_edits.ui_total)}</div>
            <div class="ver-label">UI edits</div>
            <div class="ver-sub">entry creates + deletes</div>
          </div>
          <div class="ver-stat">
            <div class="ver-value">{format_number(entry_edits.api_total)}</div>
            <div class="ver-label">Agent API edits</div>
            <div class="ver-sub">creates + updates + deletes, bulk-weighted</div>
          </div>
        </div>
        <ComboChart series={entry_edit_series} height={180} value_format={format_number} />
        <p class="muted">UI counts <code>entry_created</code> + <code>entry_deleted</code> events (in-place field edits aren't discrete events); API counts v1 entry writes, with bulk imports weighted by their created/updated entry counts.</p>
      {/if}
    </section>

  {/if}
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
    grid-template-columns: repeat(2, 1fr);
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
  .card .label {
    color: var(--color-secondary);
    font-size: 0.75rem;
    margin-top: 0.25rem;
  }
  .insights {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
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
  .insight-value.neg { color: var(--danger); }
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
  .dict-table {
    max-width: 34rem;
    font-variant-numeric: tabular-nums;
  }
  .dict-table .num { text-align: right; white-space: nowrap; }
  .dict-table th:not(:first-child) { text-align: right; }
  .dict-name a { color: var(--primary); text-decoration: none; font-weight: 600; }
  .dict-name a:hover { text-decoration: underline; }
  .unlisted { margin-left: 0.25rem; color: var(--color-secondary); font-size: 0.72rem; font-style: italic; }
  .anon { color: var(--color-secondary); }
  .dict-note {
    margin: 0.6rem 0 0;
    font-size: 0.72rem;
    color: var(--color-secondary);
    line-height: 1.45;
    max-width: 44rem;
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
  .muted { color: var(--color-secondary); font-size: 0.8125rem; margin: 0; }
  @media (max-width: 48rem) {
    .cards { grid-template-columns: repeat(2, 1fr); }
    .insights { grid-template-columns: repeat(2, 1fr); }
    .grid { grid-template-columns: 1fr; }
  }
</style>
