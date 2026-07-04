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
    d: string
    strong: boolean
    x2: number
    y2: number
  }

  let lines = $state<Line[]>([])

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
      const next: Line[] = []
      const seen: Record<string, true> = {}
      for (const anchor of anchors) {
        const point = map_component.project_point({ lng: anchor.card.lng, lat: anchor.card.lat })
        if (!point)
          continue
        // one line per dictionary (the loop duplicates cards)
        const key = `${anchor.card.id}-${Math.round(anchor.x)}`
        if (seen[key])
          continue
        seen[key] = true
        const x1 = anchor.x - container_rect.left
        const y1 = anchor.y - container_rect.top
        const x2 = point.x + map_rect.left - container_rect.left
        const y2 = point.y + map_rect.top - container_rect.top
        if (y2 < 0 || y2 > y1)
          continue
        const mid_y = (y1 + y2) / 2
        next.push({
          key,
          d: `M ${x1.toFixed(1)} ${y1.toFixed(1)} C ${x1.toFixed(1)} ${mid_y.toFixed(1)}, ${x2.toFixed(1)} ${mid_y.toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}`,
          strong: anchor.strong,
          x2,
          y2,
        })
      }
      lines = next
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  })
</script>

<div class="hero-unit" bind:this={container}>
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

    <WordCards
      bind:this={strip_component}
      {cards}
      {map_view}
      on_active_dict={dict_id => active_dict_id = dict_id} />

    <svg class="lines" aria-hidden="true">
      {#each lines as line (line.key)}
        <path class={['line', { strong: line.strong }]} d={line.d} />
        {#if line.strong}
          <circle class="line-end" cx={line.x2} cy={line.y2} r="3.5" />
        {/if}
      {/each}
    </svg>
  {/if}
</div>

<style>
  .hero-unit {
    position: relative;
    max-width: 80rem;
    margin: 0 auto;
    padding: 0.5rem 1rem 0;
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

  /* light-dark() rides on theme.css's per-mode color-scheme */
  .line {
    fill: none;
    stroke: light-dark(rgb(239 68 68 / 0.16), rgb(248 113 113 / 0.3));
    stroke-width: 1;
    transition: stroke 250ms;
  }

  .line.strong {
    stroke: light-dark(rgb(220 38 38 / 0.9), rgb(248 113 113 / 0.95));
    stroke-width: 1.5;
  }

  .line-end {
    fill: light-dark(#dc2626, #f87171);
  }
</style>
