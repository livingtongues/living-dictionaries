<script lang="ts">
  // Single-series time chart. D3 does the math (scales + path generators);
  // Svelte renders the SVG. Ported from the finances dashboard engine and
  // adapted to house theme vars. Features: area fill, snapping hover tooltip,
  // and optional vertical key-event markers (lane-stacked label chips + notes).
  import { extent, max, min } from 'd3-array'
  import { scaleLinear, scaleTime } from 'd3-scale'
  import { curveMonotoneX, area as d3area, line as d3line } from 'd3-shape'
  import { format_point_date } from '$lib/utils/format-relative-time'

  interface Pt { date: string, value: number }
  interface NoteItem { label: string, text: string, color?: string }
  interface Evt { date: string, label: string, color?: string, note?: { title: string, items: NoteItem[] } }

  interface Props {
    series: Pt[]
    events?: Evt[]
    height?: number
    color?: string
    area?: boolean
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

  // measured chip box sizes (HTML-in-foreignObject auto-sizes to its text — we read
  // the rendered width/height back to clamp chips in-bounds and stack them into lanes).
  let chip_w = $state<number[]>([])
  let chip_h = $state<number[]>([])
  const EV_GAP = 8
  // Greedy lane assignment so overlapping event chips don't collide.
  const ev_layout = $derived.by(() => {
    const order = evts.map((_, i) => i).sort((a, b) => xs(evts[a].d) - xs(evts[b].d))
    const lane_right: number[] = []
    const lane = Array.from({ length: evts.length }, () => 0)
    for (const i of order) {
      const left = Math.min(Math.max(xs(evts[i].d), 0), iw - (chip_w[i] ?? 80))
      let slot = 0
      while (slot < lane_right.length && left < lane_right[slot] + EV_GAP) slot++
      lane[i] = slot
      lane_right[slot] = left + (chip_w[i] ?? 80)
    }
    return { lane, lanes: Math.max(1, lane_right.length) }
  })
  const mt = $derived(events.length ? 14 + ev_layout.lanes * 22 : 12)
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
  const xticks = $derived(xs.ticks(6))
  const yticks = $derived(ys.ticks(5))

  let svg_el: SVGSVGElement
  let hover = $state<{ ix: number, cy: number, raw: string, value: number } | null>(null)

  let hover_note = $state<number | null>(null)
  let pinned_note = $state<number | null>(null)
  const active_note = $derived(pinned_note != null ? pinned_note : hover_note)
  function toggle_note(i: number) {
    pinned_note = pinned_note === i ? null : i
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
        {@const zero = Math.abs(t) < 1e-9}
        <line x1={0} x2={iw} y1={ys(t)} y2={ys(t)} stroke={zero ? 'var(--color-secondary)' : 'var(--border-color)'} stroke-opacity={zero ? 0.9 : 0.7} stroke-width={zero ? 1.5 : 1} />
        <text x={-9} y={ys(t) + 4} text-anchor="end" font-size="13" font-weight={zero ? 700 : 400} fill={zero ? 'var(--color)' : 'var(--color-secondary)'}>{y_format(t)}</text>
      {/each}
      {#each xticks as t (t.getTime())}
        <text x={xs(t)} y={ih + 19} text-anchor="middle" font-size="13" fill="var(--color-secondary)">{tick_label(t)}</text>
      {/each}

      {#each evts as e, i (i)}
        {@const x = xs(e.d)}
        {@const c = e.color ?? 'var(--color-secondary)'}
        {@const off = ev_layout.lane[i] * ((chip_h[i] ?? 18) + EV_GAP)}
        <line x1={x} x2={x} y1={-6 - off} y2={ih} stroke={c} stroke-width="1" stroke-dasharray="3 3" stroke-opacity="0.65" />
        <foreignObject
          x={Math.min(Math.max(x, 0), iw - (chip_w[i] ?? 80))}
          y={-7 - (chip_h[i] ?? 18) - off}
          width="180"
          height="44"
          style="overflow:visible;pointer-events:none">
          <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
          <div
            class={e.note ? 'chip has-note' : 'chip'}
            bind:clientWidth={chip_w[i]}
            bind:clientHeight={chip_h[i]}
            style:color={c}
            role={e.note ? 'button' : undefined}
            tabindex={e.note ? 0 : undefined}
            onpointerenter={e.note ? () => (hover_note = i) : undefined}
            onpointerleave={e.note ? () => (hover_note = null) : undefined}
            onclick={e.note ? () => toggle_note(i) : undefined}
            onkeydown={e.note
              ? (ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                  ev.preventDefault()
                  toggle_note(i)
                }
              }
              : undefined}>
            <span>{e.label}</span>
            {#if e.note}<span class="chip-q">?</span>{/if}
          </div>
        </foreignObject>
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

  {#if hover}
    <div class="tip" style:left={`${tip_left}%`} style:top={`${events.length ? 30 : 6}px`} style:transform={tip_shift}>
      <div class="tip-date">{format_point_date(hover.raw)}</div>
      <div class="tip-row">
        <span class="dot" style:background={color}></span>
        <span class="tip-val">{tip_format(hover.value)}</span>
      </div>
    </div>
  {/if}

  {#if active_note != null}
    {@const e = evts[active_note]}
    {#if e?.note}
      {@const nx = ((m.l + xs(e.d)) / W) * 100}
      <div
        class="note"
        style:left={`${nx}%`}
        style:transform={nx > 62 ? 'translateX(-92%)' : nx < 24 ? 'translateX(-8%)' : 'translateX(-50%)'}>
        <div class="note-title">{e.note.title}</div>
        {#each e.note.items as it (it.label)}
          <div class="note-row">
            <span class="note-label" style:color={it.color ?? 'var(--color)'}>{it.label}</span><span class="note-text">{it.text}</span>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .wrap { position: relative; }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    box-sizing: border-box;
    width: max-content;
    max-width: 132px;
    padding: 2px 8px;
    font-family: inherit;
    font-size: 10.5px;
    line-height: 1.18;
    border-radius: 9px;
    border: 1px solid color-mix(in srgb, currentColor 50%, transparent);
    background: color-mix(in srgb, currentColor 16%, transparent);
    white-space: normal;
    overflow-wrap: anywhere;
    pointer-events: auto;
  }
  .chip-q {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 13px;
    height: 13px;
    border-radius: 50%;
    font-size: 9px;
    font-weight: 700;
    background: color-mix(in srgb, currentColor 25%, transparent);
  }
  .chip.has-note { cursor: pointer; }
  .chip.has-note:hover,
  .chip.has-note:focus-visible {
    background: color-mix(in srgb, currentColor 30%, transparent);
    outline: none;
  }
  .note {
    position: absolute;
    top: 28px;
    max-width: 320px;
    pointer-events: none;
    background: var(--surface);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
    padding: 0.6rem 0.7rem;
    font-size: 0.76rem;
    line-height: 1.38;
    z-index: 3;
  }
  .note-title { font-weight: 800; font-size: 0.84rem; margin-bottom: 0.35rem; }
  .note-row + .note-row { margin-top: 0.32rem; }
  .note-label { font-weight: 700; margin-right: 0.4rem; }
  .note-text { color: var(--color-secondary); }
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
