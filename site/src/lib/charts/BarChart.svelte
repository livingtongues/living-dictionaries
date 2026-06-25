<script lang="ts">
  // Horizontal bar chart. Caller passes data already sorted (desc). Ported from
  // the finances dashboard engine, adapted to house theme vars.
  import { max } from 'd3-array'
  import { scaleLinear } from 'd3-scale'

  interface Bar { label: string, value: number, color?: string }
  interface Props {
    data: Bar[]
    row_height?: number
    label_width?: number
    format?: (value: number) => string
  }
  const {
    data,
    row_height = 30,
    label_width = 160,
    format = (value: number) => String(value),
  }: Props = $props()

  const W = 600
  const m = $derived({ t: 4, r: 64, b: 4, l: label_width })
  const iw = $derived(W - m.l - m.r)
  const height = $derived(data.length * row_height + m.t + m.b)
  const xs = $derived(scaleLinear().domain([0, max(data, d => d.value) || 1]).range([0, iw]))
</script>

<svg viewBox={`0 0 ${W} ${height}`} style="width:100%;height:auto;display:block" role="img">
  <g transform={`translate(${m.l},${m.t})`}>
    {#each data as d, i (d.label)}
      {@const y = i * row_height}
      <text x={-10} y={y + row_height / 2 + 5} text-anchor="end" font-size="15" fill="var(--color)">
        {d.label.length > 22 ? `${d.label.slice(0, 21)}…` : d.label}
      </text>
      <rect x={0} y={y + 4} width={iw} height={row_height - 10} rx="4" fill="rgba(127, 127, 127, 0.14)" />
      <rect
        x={0}
        y={y + 4}
        width={Math.max(2, xs(d.value))}
        height={row_height - 10}
        rx="4"
        fill={d.color ?? 'var(--primary)'} />
      <text x={xs(d.value) + 8} y={y + row_height / 2 + 5} font-size="14" fill="var(--color-secondary)" style="font-variant-numeric: tabular-nums">
        {format(d.value)}
      </text>
    {/each}
  </g>
</svg>
