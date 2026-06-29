<script lang="ts">
  // Multi-series time chart (D3 scales + path generators, Svelte renders SVG).
  // Overlays several series on one axis + a clustered key-event rail (deploys), with a
  // snapping hover tooltip that interpolates each series' on-line value at the snapped
  // date and shows labeled "gap" rows (differences between series).
  // Ported from the finances dashboard engine, adapted to house theme vars.
  import { extent, max } from 'd3-array'
  import { scaleLinear, scaleTime } from 'd3-scale'
  import { curveMonotoneX, area as d3area, line as d3line } from 'd3-shape'
  import { format_point_date } from '$lib/utils/format-relative-time'
  import { cluster_events } from './cluster-events'
  import EventRail from './EventRail.svelte'

  interface Pt { date: string, value: number }
  interface Series { label: string, color: string, points: Pt[], area?: boolean }
  interface NoteItem { label: string, text: string, color?: string }
  interface Evt { date: string, label: string, color?: string, current?: boolean, note?: { title: string, items: NoteItem[] } }
  interface Gap { label: string, from: number, to: number }

  interface Props {
    series: Series[]
    events?: Evt[]
    height?: number
    gaps?: Gap[]
    /** Glyph for the deploy rail ticks (🚀 in house/tutor, ⬆ in LD). */
    event_icon?: string
    /** Tooltip + axis value formatter. */
    value_format?: (value: number) => string
  }
  const {
    series,
    events = [],
    height = 320,
    gaps = [],
    event_icon = '🚀',
    value_format = (value: number) => String(Math.round(value)),
  }: Props = $props()

  const W = 860
  const m = { r: 18, b: 26, l: 58 }
  const iw = W - m.l - m.r
  // Fixed top band: holds the clustered deploy rail (no more growing chip lanes).
  const mt = $derived(events.length ? 30 : 14)
  const ih = $derived(height - mt - m.b)

  function to_date(value: string): Date {
    const parts = value.split('-').map(Number)
    return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1)
  }
  const prepared = $derived(
    series.map(s => ({
      ...s,
      pts: s.points
        .map(d => ({ date: to_date(d.date), value: d.value, raw: d.date }))
        .sort((a, b) => +a.date - +b.date),
    })),
  )
  const evts = $derived(events.map(e => ({ ...e, d: to_date(e.date) })))
  const all_dates = $derived([
    ...prepared.flatMap(s => s.pts.map(p => p.date)),
    ...evts.map(e => e.d),
  ])
  const xs = $derived(scaleTime().domain(extent(all_dates) as [Date, Date]).range([0, iw]))
  const y_max = $derived(max(prepared.flatMap(s => s.pts.map(p => p.value))) ?? 1)
  const ys = $derived(scaleLinear().domain([0, y_max * 1.06]).range([ih, 0]).nice())

  // Cluster deploy markers so a burst collapses to one tick instead of a pile.
  const EVENT_GAP = 28
  const event_clusters = $derived(
    cluster_events({ points: evts.map(e => ({ item: e, x: xs(e.d) })), min_gap: EVENT_GAP }),
  )
  const rail_clusters = $derived(
    event_clusters.map(c => ({ left_pct: ((m.l + c.x) / W) * 100, items: c.items })),
  )

  const line_path = (pts: { date: Date, value: number }[]) =>
    d3line<{ date: Date, value: number }>()
      .x(d => xs(d.date))
      .y(d => ys(d.value))
      .curve(curveMonotoneX)(pts)
  const area_path = (pts: { date: Date, value: number }[]) =>
    d3area<{ date: Date, value: number }>()
      .x(d => xs(d.date))
      .y0(ih)
      .y1(d => ys(d.value))
      .curve(curveMonotoneX)(pts)

  const xticks = $derived(xs.ticks(7))
  const yticks = $derived(ys.ticks(5))

  // Adaptive x-tick labels: month + 2-digit year for ≤~13-month windows, else year.
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const span_days = $derived.by(() => {
    const [lo, hi] = extent(all_dates) as [Date | undefined, Date | undefined]
    return lo && hi ? (+hi - +lo) / 86_400_000 : 0
  })
  function tick_label(date: Date): string {
    return span_days <= 400 ? `${MONTHS[date.getMonth()]} '${String(date.getFullYear()).slice(2)}` : String(date.getFullYear())
  }

  // Value of a (date-sorted) series at time t, linearly interpolated between
  // neighbours and clamped to the endpoints outside its range.
  function value_at(pts: { date: Date, value: number }[], t: number): number {
    if (t <= +pts[0].date)
      return pts[0].value
    const last = pts[pts.length - 1]
    if (t >= +last.date)
      return last.value
    for (let i = 1; i < pts.length; i++) {
      if (+pts[i].date >= t) {
        const a = pts[i - 1]
        const b = pts[i]
        const f = (t - +a.date) / (+b.date - +a.date)
        return a.value + f * (b.value - a.value)
      }
    }
    return last.value
  }

  interface HoverItem { label: string, color: string, value: number, cy: number }
  let svg_el: SVGSVGElement
  let hover = $state<{ ix: number, raw: string, items: HoverItem[], gaps: { label: string, value: number }[] } | null>(null)

  function on_move(event: PointerEvent) {
    if (!svg_el)
      return
    const rect = svg_el.getBoundingClientRect()
    const ix = ((event.clientX - rect.left) / rect.width) * W - m.l
    const iy = ((event.clientY - rect.top) / rect.height) * height - mt
    if (ix < -6 || ix > iw + 6 || iy < 0 || iy > ih) {
      hover = null
      return
    }
    let best_pt: { date: Date, raw: string } | null = null
    let best_dist = Infinity
    for (const s of prepared) {
      for (const p of s.pts) {
        const dist = Math.abs(xs(p.date) - ix)
        if (dist < best_dist) {
          best_dist = dist
          best_pt = p
        }
      }
    }
    if (!best_pt) {
      hover = null
      return
    }
    const t = +best_pt.date
    const items: HoverItem[] = []
    for (const s of prepared) {
      if (s.pts.length === 0)
        continue
      const v = value_at(s.pts, t)
      items.push({ label: s.label, color: s.color, value: v, cy: ys(v) })
    }
    const gap_defs: Gap[] = gaps.length
      ? gaps
      : items.length >= 2
      ? [{ label: 'Difference', from: 0, to: 1 }]
      : []
    const gap_rows = gap_defs
      .filter(g => items[g.from] && items[g.to])
      .map(g => ({ label: g.label, value: items[g.from].value - items[g.to].value }))
    hover = { ix: xs(best_pt.date), raw: best_pt.raw, items, gaps: gap_rows }
  }

  const tip_left = $derived(hover ? ((m.l + hover.ix) / W) * 100 : 0)
  const tip_shift = $derived(tip_left > 70 ? 'translateX(-100%)' : tip_left < 30 ? 'translateX(0)' : 'translateX(-50%)')
</script>

<div class="legend">
  {#each series as s (s.label)}
    <span class="item"><span class="sw" style:background={s.color}></span>{s.label}</span>
  {/each}
</div>

<div class="wrap">
  <svg
    bind:this={svg_el}
    viewBox={`0 0 ${W} ${height}`}
    style="width:100%;height:auto;display:block;touch-action:none"
    role="img"
    onpointermove={on_move}
    onpointerleave={() => (hover = null)}>
    <g transform={`translate(${m.l},${mt})`}>
      {#each yticks as t (t)}
        <line x1={0} x2={iw} y1={ys(t)} y2={ys(t)} stroke="var(--border-color)" stroke-opacity="0.7" />
        <text x={-10} y={ys(t) + 4} text-anchor="end" font-size="14" fill="var(--color-secondary)">{value_format(t)}</text>
      {/each}
      {#each xticks as t (t.getTime())}
        <text x={xs(t)} y={ih + 19} text-anchor="middle" font-size="14" fill="var(--color-secondary)">{tick_label(t)}</text>
      {/each}

      {#each event_clusters as cluster, i (i)}
        {@const current = cluster.items.some(it => it.current)}
        <line
          x1={cluster.x}
          x2={cluster.x}
          y1={6 - mt}
          y2={ih}
          stroke={current ? 'var(--primary)' : 'var(--color-secondary)'}
          stroke-width="1"
          stroke-dasharray="3 3"
          stroke-opacity={current ? 0.6 : 0.4} />
      {/each}

      {#each prepared as s (s.label)}
        {#if s.area}<path d={area_path(s.pts)} fill={s.color} fill-opacity="0.1" />{/if}
        <path d={line_path(s.pts)} fill="none" stroke={s.color} stroke-width="2.25" />
      {/each}

      {#if hover}
        <line x1={hover.ix} x2={hover.ix} y1={0} y2={ih} stroke="var(--color-secondary)" stroke-opacity="0.4" stroke-width="1" />
        {#each hover.items as it (it.label)}
          <circle cx={hover.ix} cy={it.cy} r="4.5" fill={it.color} stroke="var(--surface)" stroke-width="2" />
        {/each}
      {/if}
    </g>
  </svg>

  {#if rail_clusters.length}
    <EventRail clusters={rail_clusters} icon={event_icon} />
  {/if}

  {#if hover}
    <div class="tip" style:left={`${tip_left}%`} style:transform={tip_shift}>
      <div class="tip-date">{format_point_date(hover.raw)}</div>
      {#each hover.items as it (it.label)}
        <div class="tip-row">
          <span class="dot" style:background={it.color}></span>
          <span class="tip-label">{it.label}</span>
          <span class="tip-val">{value_format(it.value)}</span>
        </div>
      {/each}
      {#each hover.gaps as g (g.label)}
        <div class="tip-row gap">
          <span class="dot" style="background:transparent"></span>
          <span class="tip-label">{g.label}</span>
          <span class="tip-val">{value_format(g.value)}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .legend { display: flex; gap: 1.1rem; margin-bottom: 0.4rem; font-size: 0.8rem; color: var(--color-secondary); }
  .item { display: inline-flex; align-items: center; gap: 0.35rem; }
  .sw { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
  .wrap { position: relative; }
  .tip {
    position: absolute;
    top: 34px;
    pointer-events: none;
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
    padding: 0.45rem 0.6rem;
    font-size: 0.78rem;
    line-height: 1.3;
    white-space: nowrap;
    z-index: 2;
  }
  .tip-date { color: var(--color-secondary); font-size: 0.72rem; margin-bottom: 0.3rem; }
  .tip-row { display: flex; align-items: center; gap: 0.45rem; }
  .tip-row + .tip-row { margin-top: 0.15rem; }
  .tip-row.gap { margin-top: 0.3rem; padding-top: 0.3rem; border-top: 1px solid var(--border-color); color: var(--color-secondary); }
  .dot { width: 9px; height: 9px; border-radius: 3px; flex: none; }
  .tip-label { margin-right: 0.5rem; }
  .tip-val { font-weight: 700; font-variant-numeric: tabular-nums; margin-left: auto; }
</style>
