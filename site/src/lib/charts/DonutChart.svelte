<script lang="ts">
  // Donut chart, optionally a two-ring "sunburst": inner ring = top-level
  // categories, outer ring = each category's children within its angular span (set
  // `nested={false}` to keep a single ring while still listing children in the
  // legend). Hovering a wedge highlights its legend row and vice-versa. Colors come
  // from the caller (semantic per-category); a fallback palette covers any gaps.
  // Reusable across the house/LD/tutor analytics pages.
  import { arc } from 'd3-shape'

  export interface DonutChild {
    label: string
    value: number
    color?: string
  }
  export interface DonutDatum {
    label: string
    value: number
    color?: string
    children?: DonutChild[]
  }
  interface Props {
    data: DonutDatum[]
    size?: number
    thickness?: number
    gap?: number
    pad_angle?: number
    nested?: boolean
    center_value?: string
    center_label?: string
    format?: (value: number) => string
    /** Makes wedges + legend rows clickable (e.g. jump to a filtered view). */
    on_select?: (index: number) => void
    /** Let long legend labels wrap instead of ellipsizing. */
    wrap_labels?: boolean
  }
  const {
    data,
    size = 200,
    thickness = 26,
    gap = 3,
    pad_angle = 0.014,
    nested = true,
    center_value,
    center_label,
    format = (value: number) => String(value),
    on_select = undefined,
    wrap_labels = false,
  }: Props = $props()

  const FALLBACK = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#64748b', '#3b82f6', '#ef4444']

  let hovered = $state<number | null>(null)

  const total = $derived(data.reduce((sum, datum) => sum + datum.value, 0) || 1)
  const has_children = $derived(nested && data.some(datum => (datum.children?.length ?? 0) > 0))

  const cx = $derived(size / 2)
  const cy = $derived(size / 2)
  const outer_r2 = $derived(size / 2 - 1)
  const outer_r1 = $derived(outer_r2 - thickness)
  // Without an outer ring we draw a single, slightly bolder ring at the outer edge.
  const inner_r2 = $derived(has_children ? outer_r1 - gap : outer_r2)
  const inner_r1 = $derived(has_children ? inner_r2 - thickness : outer_r2 - thickness * 1.25)

  interface Wedge { d: string, color: string, parent: number }

  const inner_arc = $derived(arc<{ a0: number, a1: number }>()
    .innerRadius(inner_r1).outerRadius(inner_r2).cornerRadius(3).padAngle(pad_angle)
    .startAngle(seg => seg.a0).endAngle(seg => seg.a1))
  const outer_arc = $derived(arc<{ a0: number, a1: number }>()
    .innerRadius(outer_r1).outerRadius(outer_r2).cornerRadius(2).padAngle(pad_angle)
    .startAngle(seg => seg.a0).endAngle(seg => seg.a1))

  const inner_wedges = $derived.by<Wedge[]>(() => {
    const out: Wedge[] = []
    let angle = 0
    data.forEach((datum, index) => {
      const span = (datum.value / total) * 2 * Math.PI
      const color = datum.color ?? FALLBACK[index % FALLBACK.length]
      out.push({ d: inner_arc({ a0: angle, a1: angle + span }) ?? '', color, parent: index })
      angle += span
    })
    return out
  })

  const outer_wedges = $derived.by<Wedge[]>(() => {
    if (!has_children)
      return []
    const out: Wedge[] = []
    let angle = 0
    data.forEach((datum, index) => {
      const span = (datum.value / total) * 2 * Math.PI
      const base = datum.color ?? FALLBACK[index % FALLBACK.length]
      const kids = datum.children?.length ? datum.children : [{ label: datum.label, value: datum.value, color: base }]
      const kid_total = kids.reduce((sum, kid) => sum + kid.value, 0) || 1
      let kid_angle = angle
      kids.forEach((kid, kid_index) => {
        const kid_span = (kid.value / kid_total) * span
        // Biggest child = base color; each subsequent slice steps lighter.
        out.push({ d: outer_arc({ a0: kid_angle, a1: kid_angle + kid_span }) ?? '', color: kid.color ?? lighten(base, kid_index * 0.16), parent: index })
        kid_angle += kid_span
      })
      angle += span
    })
    return out
  })

  const legend_rows = $derived(data.map((datum, index) => ({
    index,
    label: datum.label,
    color: datum.color ?? FALLBACK[index % FALLBACK.length],
    pct: datum.value / total,
    value: datum.value,
    children: (datum.children ?? []).filter(kid => kid.label !== 'unknown').map(kid => kid.label),
  })))

  function dimmed(parent: number): boolean {
    return hovered !== null && hovered !== parent
  }

  // Lighten a #rrggbb toward white by `t` (0..1) for graded version sub-slices.
  function lighten(hex: string, amount: number): string {
    const t = Math.min(0.6, Math.max(0, amount))
    const value = hex.replace('#', '')
    if (value.length !== 6)
      return hex
    const channels = [0, 2, 4].map(start => Number.parseInt(value.slice(start, start + 2), 16))
    const mixed = channels.map(channel => Math.round(channel + (255 - channel) * t))
    return `#${mixed.map(channel => channel.toString(16).padStart(2, '0')).join('')}`
  }
</script>

<div class="donut">
  <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" style="flex:none">
    <g transform={`translate(${cx},${cy})`}>
      {#each inner_wedges as wedge, i (i)}
        <path d={wedge.d} fill={wedge.color} class:dim={dimmed(wedge.parent)} class:selectable={!!on_select} role="presentation" onmouseenter={() => (hovered = wedge.parent)} onmouseleave={() => (hovered = null)} onclick={() => on_select?.(wedge.parent)} />
      {/each}
      {#each outer_wedges as wedge, i (i)}
        <path d={wedge.d} fill={wedge.color} class:dim={dimmed(wedge.parent)} class:selectable={!!on_select} role="presentation" onmouseenter={() => (hovered = wedge.parent)} onmouseleave={() => (hovered = null)} onclick={() => on_select?.(wedge.parent)} />
      {/each}
    </g>
    {#if center_value || center_label}
      <text x={cx} y={center_label ? cy - 2 : cy + 6} text-anchor="middle" font-size="22" font-weight="700" fill="var(--color)" style="font-variant-numeric:tabular-nums">{center_value}</text>
      {#if center_label}
        <text x={cx} y={cy + 16} text-anchor="middle" font-size="11" fill="var(--color-secondary)">{center_label}</text>
      {/if}
    {/if}
  </svg>
  <ul class="legend">
    {#each legend_rows as row (row.label)}
      <li
        class:dim={dimmed(row.index)}
        class:selectable={!!on_select}
        title={`${row.label}: ${format(row.value)}`}
        role={on_select ? 'button' : undefined}
        tabindex={on_select ? 0 : undefined}
        onmouseenter={() => (hovered = row.index)}
        onmouseleave={() => (hovered = null)}
        onclick={() => on_select?.(row.index)}
        onkeydown={(event) => { if (on_select && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); on_select(row.index) } }}>
        <span class="swatch" style:background={row.color}></span>
        <span class="leg-label" class:wrap={wrap_labels}>{row.label}</span>
        <span class="leg-pct">{(row.pct * 100).toFixed(0)}%</span>
        <span class="leg-count">{format(row.value)}</span>
        {#if row.children.length}<span class="leg-kids">{row.children.join(' · ')}</span>{/if}
      </li>
    {/each}
  </ul>
</div>

<style>
  .donut {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }
  path {
    transition: opacity 0.12s ease;
    cursor: default;
  }
  path.dim {
    opacity: 0.28;
  }
  path.selectable,
  .legend li.selectable {
    cursor: pointer;
  }
  .legend {
    list-style: none;
    margin: 0;
    padding: 0;
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.8125rem;
  }
  .legend li {
    display: grid;
    grid-template-columns: auto 1fr auto auto;
    align-items: baseline;
    column-gap: 0.5rem;
    font-variant-numeric: tabular-nums;
    transition: opacity 0.12s ease;
    cursor: default;
  }
  .legend li.dim {
    opacity: 0.35;
  }
  .swatch {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 0.2rem;
    align-self: center;
  }
  .leg-label {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .leg-label.wrap {
    white-space: normal;
    overflow-wrap: break-word;
  }
  .leg-pct {
    font-weight: 700;
  }
  .leg-count {
    color: var(--color-secondary);
    font-size: 0.72rem;
  }
  .leg-kids {
    grid-column: 2 / -1;
    color: var(--color-secondary);
    font-size: 0.7rem;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
