<script lang="ts">
  import type { FeaturedCard, MapDict } from './types'
  import type { SsrMap } from './map/ssr-map'
  import type { MapView } from './map/WorldMap.svelte'
  import { onMount } from 'svelte'
  import { page } from '$app/state'
  import { WORLD_ASPECT } from './map/projection'
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
      // a single line at a time — only the card nearest the strip center (or the
      // hovered/playing card); neighbors stay mounted at 0 so the fades can run
      const center_anchor = !any_active && anchors.length
        ? anchors.reduce((closest, anchor) =>
          Math.abs(anchor.offset_cards) < Math.abs(closest.offset_cards) ? anchor : closest)
        : null
      const next: Line[] = []
      // one line per card — the loop duplicates cards, keep the strongest copy
      const strongest_by_card: Record<string, Line> = {}
      for (const anchor of anchors) {
        const point = map_component.project_point({ lng: anchor.card.lng, lat: anchor.card.lat })
        if (!point)
          continue
        const opacity = any_active
          ? (anchor.active ? 1 : 0)
          : (anchor === center_anchor ? 1 : 0)
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
          // keyed per card (not per loop copy) so a handoff animates the same
          // element instead of recreating it and skipping the CSS transition
          key: anchor.card.id,
          dict_id: anchor.card.dict_id,
          d: `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${x1.toFixed(1)} ${mid_y.toFixed(1)}, ${x2.toFixed(1)} ${mid_y.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`,
          opacity,
          label_opacity: opacity,
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
    <div class="map-frame" style="--world-aspect: {WORLD_ASPECT}" bind:this={map_frame}>
      <WorldMap
        bind:this={map_component}
        {dicts}
        {ssr_map}
        highlighted_dict_id={active_dict_id}
        on_view_change={view => map_view = view} />
    </div>
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
        <text class="dot-label" x={line.label_x} y={line.y2 - 10} style="opacity: {line.label_opacity.toFixed(3)}">{line.label}</text>
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
    /* height follows the trimmed world's aspect — no vertical letterbox where
       Antarctica would peek in; very short windows cap at 58vh (empty-ocean
       side bands, which the projection clip keeps land-free) */
    aspect-ratio: var(--world-aspect);
    max-height: 58vh;
    min-height: 300px;
    border-radius: 1rem;
    overflow: hidden;
  }

  @media (max-width: 640px) {
    /* full-bleed to the screen edge on mobile */
    .hero-constrained {
      padding: 0;
    }

    .map-frame {
      height: clamp(220px, 56vw, 300px);
      min-height: 0;
      border-radius: 0;
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

  /* opacity flips 0↔1 per-frame as the center/hovered card changes; the CSS
     transition turns the flip into a short crossfade */
  .line-group {
    transition: opacity 250ms ease;
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
    transition: opacity 250ms ease;
  }
</style>
