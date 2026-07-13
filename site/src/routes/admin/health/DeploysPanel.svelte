<script lang="ts">
  import type { DeployMetric } from '$lib/db/server/deploy-metrics'
  import { GITHUB_REPO_URL } from '$lib/constants'

  let { deploys }: { deploys: DeployMetric[] } = $props()

  const CHART_MAX = 40
  const TABLE_MAX = 12
  const BAR_AREA_PX = 150

  const chart_rows = $derived(deploys.slice(-CHART_MAX))
  const table_rows = $derived(deploys.slice(-TABLE_MAX).reverse())
  const machine = $derived(deploys[deploys.length - 1]?.machine)

  function bar_seconds(deploy: DeployMetric): number {
    return deploy.total_s ?? deploy.rollout_s ?? 0
  }
  const max_seconds = $derived(Math.max(60, ...chart_rows.map(bar_seconds)))

  // Horizontal minute gridlines so a bar's duration reads off the axis without a
  // hover. Step snaps to a tidy interval giving ~3-5 lines across the range.
  const GRID_STEPS = [30, 60, 120, 180, 300, 600, 900, 1800, 3600]
  const grid_lines = $derived.by(() => {
    const step = GRID_STEPS.find(candidate => max_seconds / candidate <= 5) ?? 3600
    const lines: { seconds: number, label: string }[] = []
    for (let seconds = step; seconds <= max_seconds; seconds += step)
      lines.push({ seconds, label: format_s(seconds) })
    return lines
  })

  const PULL_COLOR = '#06b6d4'
  const BUILD_COLOR = 'var(--primary)'
  const ROLLOUT_COLOR = '#f59e0b'
  const OTHER_COLOR = 'color-mix(in srgb, var(--color-secondary) 40%, transparent)'

  interface Segment { key: string, seconds: number, color: string }
  function segments(deploy: DeployMetric): Segment[] {
    if (deploy.outcome === 'failed')
      // Floor failed bars to ~4% height so a fast failure is still visible.
      return [{ key: 'failed', seconds: Math.max(bar_seconds(deploy), max_seconds * 0.04), color: 'var(--danger)' }]
    const out: Segment[] = []
    const pull = (deploy.pull_s ?? 0) + (deploy.preflight_s ?? 0)
    if (pull > 0)
      out.push({ key: 'pull', seconds: pull, color: PULL_COLOR })
    if (deploy.build_s)
      out.push({ key: 'build', seconds: deploy.build_s, color: BUILD_COLOR })
    if (deploy.rollout_s)
      out.push({ key: 'rollout', seconds: deploy.rollout_s, color: ROLLOUT_COLOR })
    // Unattributed remainder — the whole bar for backfilled totals-only records.
    const known = out.reduce((sum, segment) => sum + segment.seconds, 0)
    const remainder = (deploy.total_s ?? 0) - known
    if (remainder > 0)
      out.push({ key: deploy.backfilled ? 'backfilled' : 'other', seconds: remainder, color: OTHER_COLOR })
    return out
  }

  function format_s(seconds: number | undefined): string {
    if (seconds == null)
      return '—'
    if (seconds < 60)
      return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const rest = seconds % 60
    return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`
  }

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  // Deterministic UTC label (same on server + client → no hydration drift).
  function format_when(iso: string): string {
    const date = new Date(iso)
    const hh = String(date.getUTCHours()).padStart(2, '0')
    const mm = String(date.getUTCMinutes()).padStart(2, '0')
    return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()} · ${hh}:${mm}`
  }

  function tooltip(deploy: DeployMetric): string {
    const lines = [`${format_when(deploy.at)} UTC${deploy.sha ? ` · ${deploy.sha.slice(0, 7)}` : ''}${deploy.outcome === 'failed' ? ' · FAILED' : ''}`]
    lines.push(`total ${format_s(bar_seconds(deploy))}${deploy.backfilled ? ' (backfilled)' : ''}`)
    const pull = (deploy.pull_s ?? 0) + (deploy.preflight_s ?? 0)
    if (pull > 0)
      lines.push(`pull ${format_s(pull)}`)
    if (deploy.build_s)
      lines.push(`build ${format_s(deploy.build_s)}`)
    if (deploy.rollout_s || deploy.green_wait_s || deploy.blue_wait_s) {
      const waits = [deploy.green_wait_s != null ? `green ${deploy.green_wait_s}s` : '', deploy.blue_wait_s != null ? `blue ${deploy.blue_wait_s}s` : ''].filter(Boolean).join(', ')
      lines.push(`rollout ${format_s(deploy.rollout_s)}${waits ? ` (${waits})` : ''}`)
    }
    return lines.join('\n')
  }

  function median(values: number[]): number | null {
    if (values.length === 0)
      return null
    const sorted = [...values].sort((first, second) => first - second)
    return sorted[Math.floor(sorted.length / 2)]
  }
  const completed_totals = $derived(deploys.filter(deploy => deploy.outcome === 'complete' && deploy.total_s != null).map(deploy => deploy.total_s as number))
  const median_recent = $derived(median(completed_totals.slice(-10)))
  const fastest = $derived(completed_totals.length ? Math.min(...completed_totals) : null)
  const slowest = $derived(completed_totals.length ? Math.max(...completed_totals) : null)
  const failed_count = $derived(deploys.filter(deploy => deploy.outcome === 'failed').length)

  const has_phases = $derived(chart_rows.some(deploy => deploy.build_s != null))
</script>

<section class="panel">
  <h2>Deploys <span class="hint">push → serving{machine ? ` · ${machine}` : ''} · newest right · hover a bar for the breakdown</span></h2>
  {#if deploys.length === 0}
    <p class="muted">No deploy history yet — <code>deploy-metrics.jsonl</code> gets a record on every VPS deploy.</p>
  {:else}
    <div class="stats">
      <span><b>{format_s(median_recent ?? undefined)}</b> median <span class="hint">last 10</span></span>
      <span><b>{format_s(fastest ?? undefined)}</b> fastest</span>
      <span><b>{format_s(slowest ?? undefined)}</b> slowest</span>
      <span><b class:danger={failed_count > 0}>{failed_count}</b> failed</span>
      <span class="hint">{deploys.length} recorded</span>
    </div>
    <div class="chart" style:height="{BAR_AREA_PX}px">
      <div class="gridlines" aria-hidden="true">
        {#each grid_lines as line (line.seconds)}
          <div class="gridline" style:bottom="{(line.seconds / max_seconds) * BAR_AREA_PX}px"><span>{line.label}</span></div>
        {/each}
      </div>
      <div class="bars">
        {#each chart_rows as deploy (deploy.at)}
          <div class="bar" class:failed={deploy.outcome === 'failed'} title={tooltip(deploy)}>
            {#each segments(deploy) as segment (segment.key)}
              <div style:height="{(segment.seconds / max_seconds) * BAR_AREA_PX}px" style:background={segment.color}></div>
            {/each}
          </div>
        {/each}
      </div>
    </div>
    <div class="axis">
      <span>{format_when(chart_rows[0].at)}</span>
      <span class="legend">
        {#if has_phases}
          <i style:background={PULL_COLOR}></i> pull
          <i style:background={BUILD_COLOR}></i> build
          <i style:background={ROLLOUT_COLOR}></i> rollout
        {/if}
        <i style:background={OTHER_COLOR}></i> {has_phases ? 'backfilled / other' : 'total (backfilled)'}
        {#if failed_count > 0}<i style="background: var(--danger)"></i> failed{/if}
      </span>
      <span>{format_when(chart_rows[chart_rows.length - 1]?.at ?? '')}</span>
    </div>
    <details class="rows">
      <summary>Show recent deploys</summary>
      <div class="table-scroll">
        <table>
          <thead><tr><th>When (UTC)</th><th>Commit</th><th>Total</th><th>Pull</th><th>Build</th><th>Rollout</th><th></th></tr></thead>
          <tbody>
            {#each table_rows as deploy (deploy.at)}
              <tr>
                <td class="nowrap">{format_when(deploy.at)}</td>
                <td class="mono">
                  {#if deploy.sha}
                    <a href="{GITHUB_REPO_URL}/commit/{deploy.sha.replace('-dirty', '')}" target="_blank" rel="noopener noreferrer">{deploy.sha.slice(0, 7)}</a>
                  {:else}—{/if}
                </td>
                <td class="nowrap"><b>{format_s(deploy.total_s ?? deploy.rollout_s)}</b></td>
                <td class="nowrap">{format_s(deploy.pull_s != null ? deploy.pull_s + (deploy.preflight_s ?? 0) : undefined)}</td>
                <td class="nowrap">{format_s(deploy.build_s)}</td>
                <td class="nowrap">{format_s(deploy.rollout_s)}</td>
                <td class="nowrap">
                  {#if deploy.outcome === 'failed'}<span class="badge-failed">failed</span>
                  {:else if deploy.backfilled}<span class="hint">backfilled</span>{/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </details>
  {/if}
</section>

<style>
  .panel {
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-radius: 0.625rem;
    padding: 1rem 1.125rem;
    min-width: 0;
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
  .muted { color: var(--color-secondary); font-size: 0.8125rem; margin: 0; }
  .stats {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    font-size: 0.8125rem;
    font-variant-numeric: tabular-nums;
    margin-bottom: 0.75rem;
  }
  .stats b { font-size: 0.9375rem; }
  .stats b.danger { color: var(--danger); }
  .chart {
    position: relative;
  }
  .gridlines {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .gridline {
    position: absolute;
    left: 0;
    right: 0;
    border-top: 1px dashed var(--border-color);
    opacity: 0.8;
  }
  .gridline span {
    position: absolute;
    left: 0;
    top: -0.55rem;
    font-size: 0.6rem;
    line-height: 1;
    color: var(--color-secondary);
    background: var(--surface);
    padding-right: 3px;
    font-variant-numeric: tabular-nums;
  }
  .bars {
    position: relative;
    height: 100%;
    display: flex;
    align-items: flex-end;
    gap: 3px;
  }
  .bar {
    flex: 1;
    max-width: 20px;
    min-width: 4px;
    display: flex;
    flex-direction: column-reverse;
    border-radius: 2px 2px 0 0;
    overflow: hidden;
    cursor: default;
    transition: filter var(--transition-time, 150ms);
  }
  .bar:hover { filter: brightness(1.15); }
  .axis {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.75rem;
    margin-top: 0.35rem;
    font-size: 0.7rem;
    color: var(--color-secondary);
  }
  .legend { display: inline-flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; }
  .legend i {
    width: 0.6rem;
    height: 0.6rem;
    border-radius: 2px;
    display: inline-block;
  }
  .rows { margin-top: 0.75rem; }
  .rows summary {
    cursor: pointer;
    font-size: 0.8125rem;
    color: var(--color-secondary);
  }
  .table-scroll { overflow-x: auto; margin-top: 0.5rem; }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
    font-variant-numeric: tabular-nums;
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
  }
  td a { color: var(--primary); text-decoration: none; }
  td a:hover { text-decoration: underline; }
  .nowrap { white-space: nowrap; }
  .mono { font-family: var(--font-mono); font-size: 0.75rem; }
  .badge-failed {
    display: inline-block;
    padding: 0.1rem 0.45rem;
    border-radius: 9999px;
    font-size: 0.7rem;
    font-weight: 600;
    background: color-mix(in srgb, var(--danger) 16%, transparent);
    color: var(--danger);
  }
</style>
