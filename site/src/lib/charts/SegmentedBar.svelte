<script lang="ts">
  // A single 100%-width stacked horizontal bar — the "read the split in one glance"
  // treatment (GA-style). Each segment shows its name + % inline when it's wide
  // enough; thinner ones collapse to just % (or nothing), and a compact legend is
  // shown ONLY for segments too thin to carry their name (so wide segments never
  // duplicate themselves below the bar). Exact counts live in the hover title.
  // Reusable across the house/LD/tutor analytics pages.
  import { format_pct } from '$lib/constants'

  export interface Segment {
    label: string
    value: number
    color: string
    icon?: string
  }
  interface Props {
    segments: Segment[]
    height?: number
    /** Segments at/above this fraction show their name inline. */
    name_floor?: number
    /** Segments below this fraction show nothing inline (legend + title carry them). */
    pct_floor?: number
    format?: (value: number) => string
  }
  const {
    segments,
    height = 34,
    name_floor = 0.08,
    pct_floor = 0.035,
    format = (value: number) => String(value),
  }: Props = $props()

  const total = $derived(segments.reduce((sum, segment) => sum + segment.value, 0) || 1)
  const parts = $derived(segments.map(segment => ({ ...segment, fraction: segment.value / total })))
  // Only the segments that couldn't show their own name inline need a legend.
  const legend = $derived(parts.filter(part => part.fraction < name_floor))

  function tip(part: { label: string, value: number, fraction: number }): string {
    return `${part.label}: ${format(part.value)} (${format_pct(part.fraction, { digits: 0 })})`
  }
</script>

<div class="seg-wrap">
  <div class="seg-bar" style:height={`${height}px`}>
    {#each parts as part (part.label)}
      <div class="seg" style:width={`${part.fraction * 100}%`} style:background={part.color} title={tip(part)}>
        {#if part.fraction >= pct_floor}
          <span class="seg-text">
            {#if part.icon}<span class="seg-icon">{part.icon}</span>{/if}
            {#if part.fraction >= name_floor}<span class="seg-name">{part.label}</span>{/if}
            <span class="seg-pct">{format_pct(part.fraction, { digits: 0 })}</span>
          </span>
        {/if}
      </div>
    {/each}
  </div>
  {#if legend.length}
    <ul class="seg-legend">
      {#each legend as part (part.label)}
        <li title={tip(part)}>
          <span class="swatch" style:background={part.color}></span>
          {#if part.icon}<span>{part.icon}</span>{/if}
          <span class="leg-name">{part.label}</span>
          <span class="leg-pct">{format_pct(part.fraction, { digits: 0 })}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .seg-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .seg-bar {
    display: flex;
    width: 100%;
    border-radius: 0.5rem;
    overflow: hidden;
    gap: 2px;
    background: var(--surface);
  }
  .seg {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    color: #fff;
    font-size: 0.8125rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    overflow: hidden;
  }
  .seg:first-child {
    border-top-left-radius: 0.5rem;
    border-bottom-left-radius: 0.5rem;
  }
  .seg:last-child {
    border-top-right-radius: 0.5rem;
    border-bottom-right-radius: 0.5rem;
  }
  .seg-text {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0 0.4rem;
    white-space: nowrap;
  }
  .seg-icon {
    font-size: 0.95rem;
  }
  .seg-legend {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.1rem;
    font-size: 0.8125rem;
    font-variant-numeric: tabular-nums;
  }
  .seg-legend li {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }
  .swatch {
    width: 0.7rem;
    height: 0.7rem;
    border-radius: 0.2rem;
  }
  .leg-name {
    font-weight: 600;
  }
  .leg-pct {
    font-weight: 700;
  }
</style>
