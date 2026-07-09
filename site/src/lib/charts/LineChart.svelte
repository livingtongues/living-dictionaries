<script lang="ts">
  // Single-series time chart. D3 does the math (scales + path generators); Svelte
  // renders the SVG. Ported from the finances dashboard engine and adapted to house
  // theme vars. Features: area fill, snapping hover tooltip, and an optional clustered
  // key-event rail (deploys) along the top band.
  import { extent, max, min } from 'd3-array'
  import { scaleLinear, scaleTime } from 'd3-scale'
  import { curveMonotoneX, area as d3area, line as d3line } from 'd3-shape'
  import { format_point_date } from '$lib/utils/format-relative-time'
  import { cluster_events } from './cluster-events'
  import EventRail from './EventRail.svelte'

  interface Pt { date: string, value: number }
  interface NoteItem { label: string, text: string, color?: string }
  interface Evt { date: string, label: string, color?: string, current?: boolean, note?: { title: string, items: NoteItem[] } }

  interface Props {
    series: Pt[]
    events?: Evt[]
    height?: number
    color?: string
    area?: boolean
    /** Glyph for the deploy rail ticks (🚀 in house/tutor, ⬆ in LD). */
    event_icon?: string
    /** Y-axis tick label formatter. */
    y_format?: (value: number) => string
    /** Tooltip value formatter. */
    tip_format?: (value: number) => string
    /** Shared y-range across charts (else auto from this series). */
    domain?: [number, number] | null
  }
  const {
    series,
    events = [],
    height = 240,
    color = 'var(--primary)',
    area = false,
    event_icon = '🚀',
    y_format = (value: number) => String(Math.round(value)),
    tip_format = (value: number) => String(Math.round(value)),
    domain = null,
  }: Props = $props()

  const W = 820
  const m = { r: 18, b: 26, l: 56 }
  const iw = W - m.l - m.r

  function to_date(value: string): Date {
    const parts = value.split('-').map(Number)
    return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1)
  }
  const pts = $derived(
    series
      .map(d => ({ date: to_date(d.date), value: d.value, raw: d.date }))
      .sort((a, b) => +a.date - +b.date),
  )
  const evts = $derived(events.map(e => ({ ...e, d: to_date(e.date) })))
  const x_dates = $derived([...pts.map(p => p.date), ...evts.map(e => e.d)])
  const xs = $derived(scaleTime().domain(extent(x_dates) as [Date, Date]).range([0, iw]))

  // Adaptive x-tick labels: month + 2-digit year for ≤~13-month windows, else year.
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const span_days = $derived.by(() => {
    const [lo, hi] = extent(x_dates) as [Date | undefined, Date | undefined]
    return lo && hi ? (+hi - +lo) / 86_400_000 : 0
  })
  function tick_label(date: Date): string {
    return span_days <= 400 ? `${MONTHS[date.getMonth()]} '${String(date.getFullYear()).slice(2)}` : String(date.getFullYear())
  }

  // Fixed top band: holds the clustered deploy rail (no more growing chip lanes).
  const mt = $derived(events.length ? 30 : 12)
  const ih = $derived(height - mt - m.b)
  const ys = $derived(
    scaleLinear()
      .domain(
        domain
          ? [Math.min(0, domain[0]), domain[1] * 1.05]
          : [Math.min(0, min(pts, d => d.value) ?? 0), (max(pts, d => d.value) ?? 1) * 1.05],
      )
      .range([ih, 0])
      .nice(),
  )

  // Cluster deploy markers so a burst collapses to one tick instead of a pile.
  const EVENT_GAP = 28
  const event_clusters = $derived(
    cluster_events({ points: evts.map(e => ({ item: e, x: xs(e.d) })), min_gap: EVENT_GAP }),
  )
  const rail_clusters = $derived(
    event_clusters.map(c => ({ left_pct: ((m.l + c.x) / W) * 100, items: c.items })),
  )

  const line_path = $derived(
    d3line<{ date: Date, value: number }>()
      .x(d => xs(d.date))
      .y(d => ys(d.value))
      .curve(curveMonotoneX)(pts),
  )
  const area_path = $derived(
    area
      ? d3area<{ date: Date, value: number }>()
        .x(d => xs(d.date))
        .y0(ih)
        .y1(d => ys(d.value))
        .curve(curveMonotoneX)(pts)
      : null,
  )
  // Container-responsive chrome-shedding: fewer x-ticks on narrow widths so date
  // labels never collide (the viewBox keeps everything else proportional).
  let cw = $state(0)
  const x_tick_count = $derived(cw > 0 && cw < 420 ? 3 : cw > 0 && cw < 640 ? 4 : 6)
  const xticks = $derived(xs.ticks(x_tick_count))
  const yticks = $derived(ys.ticks(5))

  let svg_el: SVGSVGElement
  let hover = $state<{ ix: number, cy: number, raw: string, value: number } | null>(null)

  // Keyboard navigation: focus the chart, then ←/→ (or ↑/↓) step between points,
  // Home/End jump to the ends, Esc clears — driving the same hover/crosshair as the mouse.
  let kb_index = $state<number | null>(null)
  function focus_point(index: number) {
    if (pts.length === 0)
      return
    const i = Math.max(0, Math.min(pts.length - 1, index))
    kb_index = i
    const p = pts[i]
    hover = { ix: xs(p.date), cy: ys(p.value), raw: p.raw, value: p.value }
  }
  function on_keydown(event: KeyboardEvent) {
    if (pts.length === 0)
      return
    switch (event.key) {
      case 'ArrowRight': case 'ArrowUp': focus_point((kb_index ?? -1) + 1); break
      case 'ArrowLeft': case 'ArrowDown': focus_point((kb_index ?? pts.length) - 1); break
      case 'Home': focus_point(0); break
      case 'End': focus_point(pts.length - 1); break
      case 'Escape': kb_index = null; hover = null; break
      default: return
    }
    event.preventDefault()
  }

  function on_move(event: PointerEvent) {
    if (!svg_el || pts.length === 0)
      return
    const rect = svg_el.getBoundingClientRect()
    const ix = ((event.clientX - rect.left) / rect.width) * W - m.l
    const iy = ((event.clientY - rect.top) / rect.height) * height - mt
    if (ix < -6 || ix > iw + 6 || iy < 0 || iy > ih) {
      hover = null
      return
    }
    let [best] = pts
    let best_dist = Infinity
    for (const p of pts) {
      const dist = Math.abs(xs(p.date) - ix)
      if (dist < best_dist) {
        best_dist = dist
        best = p
      }
    }
    hover = { ix: xs(best.date), cy: ys(best.value), raw: best.raw, value: best.value }
  }

  const tip_left = $derived(hover ? ((m.l + hover.ix) / W) * 100 : 0)
  const tip_shift = $derived(tip_left > 70 ? 'translateX(-100%)' : tip_left < 30 ? 'translateX(0)' : 'translateX(-50%)')
</script>

<div class="wrap" bind:clientWidth={cw}>
  <svg
    bind:this={svg_el}
    viewBox={`0 0 ${W} ${height}`}
    style="width:100%;height:auto;display:block;touch-action:none"
    role="img"
    tabindex="0"
    onpointermove={on_move}
    onpointerleave={() => (hover = null)}
    onkeydown={on_keydown}
    onblur={() => { kb_index = null; hover = null }}>
    <g transform={`translate(${m.l},${mt})`}>
      {#each yticks as t (t)}
        {@const zero = Math.abs(t) < 1e-9}
        <line x1={0} x2={iw} y1={ys(t)} y2={ys(t)} stroke={zero ? 'var(--color-secondary)' : 'var(--border-color)'} stroke-opacity={zero ? 0.9 : 0.7} stroke-width={zero ? 1.5 : 1} />
        <text x={-9} y={ys(t) + 4} text-anchor="end" font-size="13" font-weight={zero ? 700 : 400} fill={zero ? 'var(--color)' : 'var(--color-secondary)'}>{y_format(t)}</text>
      {/each}
      {#each xticks as t (t.getTime())}
        <text x={xs(t)} y={ih + 19} text-anchor="middle" font-size="13" fill="var(--color-secondary)">{tick_label(t)}</text>
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

      {#if area_path}<path d={area_path} fill={color} fill-opacity="0.12" />{/if}
      {#if line_path}<path d={line_path} fill="none" stroke={color} stroke-width="2" />{/if}
      {#each pts as p, i (i)}
        <circle cx={xs(p.date)} cy={ys(p.value)} r="2" fill={color} />
      {/each}

      {#if hover}
        <line x1={hover.ix} x2={hover.ix} y1={0} y2={ih} stroke="var(--color-secondary)" stroke-opacity="0.4" stroke-width="1" />
        <circle cx={hover.ix} cy={hover.cy} r="4.5" fill={color} stroke="var(--surface)" stroke-width="2" />
      {/if}
    </g>
  </svg>

  {#if rail_clusters.length}
    <EventRail clusters={rail_clusters} icon={event_icon} />
  {/if}

  {#if hover}
    <div class="tip" style:left={`${tip_left}%`} style:top={`${events.length ? 30 : 6}px`} style:transform={tip_shift}>
      <div class="tip-date">{format_point_date(hover.raw)}</div>
      <div class="tip-row">
        <span class="dot" style:background={color}></span>
        <span class="tip-val">{tip_format(hover.value)}</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .wrap { position: relative; }
  svg:focus { outline: none; }
  svg:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; border-radius: 4px; }
  .tip {
    position: absolute;
    pointer-events: none;
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
    padding: 0.4rem 0.55rem;
    font-size: 0.78rem;
    line-height: 1.3;
    white-space: nowrap;
    z-index: 2;
  }
  .tip-date { color: var(--color-secondary); font-size: 0.72rem; margin-bottom: 0.2rem; }
  .tip-row { display: flex; align-items: center; gap: 0.4rem; }
  .dot { width: 9px; height: 9px; border-radius: 3px; flex: none; }
  .tip-val { font-weight: 700; font-variant-numeric: tabular-nums; }
</style>
