<script lang="ts">
  // Multi-series time chart (D3 scales + path generators, Svelte renders SVG).
  // Overlays several series on one axis + vertical key-event markers, with a
  // snapping hover tooltip that interpolates each series' on-line value at the
  // snapped date and shows labeled "gap" rows (differences between series).
  // Ported from the finances dashboard engine, adapted to house theme vars.
  import { extent, max } from 'd3-array'
  import { scaleLinear, scaleTime } from 'd3-scale'
  import { curveMonotoneX, area as d3area, line as d3line } from 'd3-shape'
  import { format_point_date } from '$lib/utils/format-relative-time'

  interface Pt { date: string, value: number }
  interface Series { label: string, color: string, points: Pt[], area?: boolean }
  interface NoteItem { label: string, text: string, color?: string }
  interface Evt { date: string, label: string, color?: string, note?: { title: string, items: NoteItem[] } }
  interface Gap { label: string, from: number, to: number }

  interface Props {
    series: Series[]
    events?: Evt[]
    height?: number
    gaps?: Gap[]
    /** Tooltip + axis value formatter. */
    value_format?: (value: number) => string
  }
  const {
    series,
    events = [],
    height = 320,
    gaps = [],
    value_format = (value: number) => String(Math.round(value)),
  }: Props = $props()

  const W = 860
  const m = { t: 42, r: 18, b: 26, l: 58 }
  const iw = W - m.l - m.r
  const ih = $derived(height - m.t - m.b)

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

  let hover_note = $state<number | null>(null)
  let pinned_note = $state<number | null>(null)
  const active_note = $derived(pinned_note != null ? pinned_note : hover_note)
  function toggle_note(i: number) {
    pinned_note = pinned_note === i ? null : i
  }
  let chip_w = $state<number[]>([])
  let chip_h = $state<number[]>([])

  function on_move(event: PointerEvent) {
    if (!svg_el)
      return
    const rect = svg_el.getBoundingClientRect()
    const ix = ((event.clientX - rect.left) / rect.width) * W - m.l
    const iy = ((event.clientY - rect.top) / rect.height) * height - m.t
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
    <g transform={`translate(${m.l},${m.t})`}>
      {#each yticks as t (t)}
        <line x1={0} x2={iw} y1={ys(t)} y2={ys(t)} stroke="var(--border-color)" stroke-opacity="0.7" />
        <text x={-10} y={ys(t) + 4} text-anchor="end" font-size="14" fill="var(--color-secondary)">{value_format(t)}</text>
      {/each}
      {#each xticks as t (t.getTime())}
        <text x={xs(t)} y={ih + 19} text-anchor="middle" font-size="14" fill="var(--color-secondary)">{tick_label(t)}</text>
      {/each}

      {#each evts as e, i (e.label)}
        {@const x = xs(e.d)}
        {@const c = e.color ?? 'var(--color-secondary)'}
        <line x1={x} x2={x} y1={-10} y2={ih} stroke={c} stroke-width="1" stroke-dasharray="3 3" stroke-opacity="0.65" />
        <foreignObject
          x={Math.min(Math.max(x, 0), iw - (chip_w[i] ?? 80))}
          y={-9 - (chip_h[i] ?? 18)}
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
  .legend { display: flex; gap: 1.1rem; margin-bottom: 0.4rem; font-size: 0.8rem; color: var(--color-secondary); }
  .item { display: inline-flex; align-items: center; gap: 0.35rem; }
  .sw { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
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
    top: 30px;
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
