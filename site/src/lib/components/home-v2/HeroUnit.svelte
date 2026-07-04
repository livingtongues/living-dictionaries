<script lang="ts">
  import type { FeaturedCard, MapDict } from './types'
  import type { SsrMap } from './map/ssr-map'
  import type { MapView } from './map/WorldMap.svelte'
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import WordCards from './WordCards.svelte'
  import WorldMap from './map/WorldMap.svelte'

  interface Props {
    dicts: MapDict[]
    ssr_map: SsrMap
    cards: FeaturedCard[]
  }

  const { dicts, ssr_map, cards }: Props = $props()
  const t = $derived(page.data.t)

  let container: HTMLDivElement = $state()
  let map_frame: HTMLDivElement = $state()
  let map_component: WorldMap = $state()
  let strip_component: WordCards = $state()
  let map_view = $state<MapView>({ k: 1, bbox: null })
  let active_dict_id = $state<string | null>(null)

  interface Line {
    key: string
    dict_id: string
    d: string
    opacity: number
    label_opacity: number
    label: string
    label_x: number
    x1: number
    y1: number
    x2: number
    y2: number
  }

  let lines = $state<Line[]>([])

  const dict_by_id = $derived(new Map(dicts.map(dict => [dict.id, dict])))

  /** 100% at center → ~70% one card out → ~20% two out → 0 beyond (piecewise linear). */
  const FALLOFF: [number, number][] = [[0, 1], [1, 0.7], [2, 0.2], [3, 0]]
  function center_falloff(offset_cards: number): number {
    const distance = Math.abs(offset_cards)
    for (let i = 1; i < FALLOFF.length; i++) {
      const [prev_d, prev_o] = FALLOFF[i - 1]
      const [next_d, next_o] = FALLOFF[i]
      if (distance <= next_d)
        return prev_o + (next_o - prev_o) * (distance - prev_d) / (next_d - prev_d)
    }
    return 0
  }

  onMount(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (!container || !map_component || !strip_component) {
        if (lines.length)
          lines = []
        return
      }
      const container_rect = container.getBoundingClientRect()
      // hero off-screen → skip the work
      if (container_rect.bottom < 0 || container_rect.top > window.innerHeight) {
        if (lines.length)
          lines = []
        return
      }
      const anchors = strip_component.get_visible_card_anchors()
      const map_rect = map_frame?.getBoundingClientRect()
      if (!map_rect)
        return
      const any_active = anchors.some(anchor => anchor.active)
      const next: Line[] = []
      // one line per card — the loop duplicates cards, keep the strongest copy
      const strongest_by_card: Record<string, Line> = {}
      for (const anchor of anchors) {
        const point = map_component.project_point({ lng: anchor.card.lng, lat: anchor.card.lat })
        if (!point)
          continue
        const opacity = any_active
          ? (anchor.active ? 1 : 0)
          : center_falloff(anchor.offset_cards)
        const x1 = anchor.x - container_rect.left
        const y1 = anchor.y - container_rect.top
        const x2 = point.x + map_rect.left - container_rect.left
        const y2 = point.y + map_rect.top - container_rect.top
        if (y2 < 0 || y2 > y1)
          continue
        const dict = dict_by_id.get(anchor.card.dict_id)
        const label = dict
          ? `${dict.name} · ${dict.entry_count.toLocaleString(page.data.locale || 'en')} ${t('home_v2.entries')}`
          : anchor.card.dict_name
        // rough half-width estimate keeps the centered label inside the container
        const half_label = label.length * 3.2 + 8
        const mid_y = (y1 + y2) / 2
        const line: Line = {
          key: `${anchor.card.id}-${anchor.index}`,
          dict_id: anchor.card.dict_id,
          d: `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${x1.toFixed(1)} ${mid_y.toFixed(1)}, ${x2.toFixed(1)} ${mid_y.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`,
          opacity,
          // steep remap: neighbors at 0.7 stay label-less; handoff crossfades near center
          label_opacity: Math.min(Math.max((opacity - 0.75) / 0.25, 0), 1),
          label,
          label_x: Math.max(half_label, Math.min(container_rect.width - half_label, x2)),
          x1,
          y1,
          x2,
          y2,
        }
        const existing = strongest_by_card[anchor.card.id]
        if (!existing || line.opacity > existing.opacity)
          strongest_by_card[anchor.card.id] = line
      }
      // a dictionary can have several featured cards — only its strongest line labels the dot
      const label_leader_by_dict: Record<string, Line> = {}
      for (const card_id of Object.keys(strongest_by_card)) {
        const line = strongest_by_card[card_id]
        next.push(line)
        const leader = label_leader_by_dict[line.dict_id]
        if (!leader || line.label_opacity > leader.label_opacity)
          label_leader_by_dict[line.dict_id] = line
      }
      for (const line of next) {
        if (label_leader_by_dict[line.dict_id] !== line)
          line.label_opacity = 0
      }
      lines = next
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  })
</script>

<div class="hero-unit" bind:this={container}>
  <div class="hero-constrained">
    <div class="map-frame" bind:this={map_frame}>
      <WorldMap
        bind:this={map_component}
        {dicts}
        {ssr_map}
        highlighted_dict_id={active_dict_id}
        on_view_change={view => map_view = view} />
    </div>

    {#if cards.length}
      <div class="showcase-heading">
        <h2>{t('home_v2.showcase_heading')}</h2>
        <p>{t('home_v2.showcase_subline')}</p>
      </div>
    {/if}
  </div>

  {#if cards.length}
    <WordCards
      bind:this={strip_component}
      {cards}
      {map_view}
      on_active_dict={dict_id => active_dict_id = dict_id} />

    <svg class="lines" aria-hidden="true">
      {#each lines as line (line.key)}
        <g class="line-group" style="opacity: {line.opacity.toFixed(3)}">
          <path class="line" d={line.d} />
          <circle class="line-anchor" cx={line.x1} cy={line.y1} r="4" />
          <circle class="line-end" cx={line.x2} cy={line.y2} r="3.5" />
        </g>
        {#if line.label_opacity > 0.01}
          <text class="dot-label" x={line.label_x} y={line.y2 - 10} style="opacity: {line.label_opacity.toFixed(3)}">{line.label}</text>
        {/if}
      {/each}
    </svg>
  {/if}
</div>

<style>
  .hero-unit {
    position: relative;
    padding: 0.5rem 0 0;
  }

  .hero-constrained {
    max-width: 80rem;
    margin: 0 auto;
    padding: 0 1rem;
  }

  .map-frame {
    position: relative;
    height: clamp(300px, 42vw, 58vh);
    border-radius: 1rem;
    overflow: hidden;
  }

  @media (max-width: 640px) {
    .map-frame {
      height: clamp(220px, 56vw, 300px);
    }
  }

  .showcase-heading {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    padding: 1rem 0.25rem 0;
    flex-wrap: wrap;
  }

  .showcase-heading h2 {
    margin: 0;
    font-size: 1.0625rem;
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  .showcase-heading p {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--color-secondary);
  }

  .lines {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: visible;
  }

  /* opacity is driven per-frame from the card's distance to the strip center;
     the transition only smooths the hover show/hide jumps (scroll is paused then) */
  .line-group {
    transition: opacity 200ms;
  }

  /* light-dark() rides on theme.css's per-mode color-scheme */
  .line {
    fill: none;
    stroke: light-dark(rgb(220 38 38 / 0.9), rgb(248 113 113 / 0.95));
    stroke-width: 1.25;
  }

  .line-anchor {
    fill: light-dark(#dc2626, #f87171);
    stroke: light-dark(#b91c1c, #fca5a5);
    stroke-width: 1.25;
  }

  .line-end {
    fill: light-dark(#dc2626, #f87171);
  }

  .dot-label {
    font-size: 11px;
    font-weight: 600;
    text-anchor: middle;
    fill: light-dark(#b91c1c, #fca5a5);
    stroke: var(--background);
    stroke-width: 3;
    paint-order: stroke;
    stroke-linejoin: round;
    transition: opacity 200ms;
  }
</style>
