<script lang="ts">
  import type { FeaturedCard } from './types'
  import type { MapView } from './map/WorldMap.svelte'
  import { onMount } from 'svelte'
  import { PUBLIC_STORAGE_BUCKET } from '$env/static/public'
  import { image_src, url_from_storage_path } from '$lib/utils/media-url'
  import { bbox_contains } from './map/view-helpers'
  import FeaturedEntryFullscreen from './FeaturedEntryFullscreen.svelte'
  import IconMdiPlay from '~icons/mdi/play'
  import IconMdiPause from '~icons/mdi/pause'

  interface Props {
    cards: FeaturedCard[]
    map_view?: MapView | null
    /** The dictionary the user is engaging with (hover or audio playing) — the map pulses its dot. */
    on_active_dict?: (dict_id: string | null) => void
  }

  const { cards, map_view = null, on_active_dict }: Props = $props()

  let scroller: HTMLDivElement = $state()
  let reduced_motion = false
  let hovered_id = $state<string | null>(null)
  let playing_id = $state<string | null>(null)
  let audio_element: HTMLAudioElement | null = null

  /** Shuffled once per visit (stable during the session so the loop doesn't jump). */
  let shuffled = $state<FeaturedCard[]>([])
  const order = $derived(shuffled.length ? shuffled : cards)
  onMount(() => {
    const copy = [...cards]
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]]
    }
    shuffled = copy
  })

  /** Debounced viewport filter: zoomed-in map narrows the strip to dictionaries in view. */
  let bbox_filter = $state<MapView['bbox']>(null)
  let filter_timeout: ReturnType<typeof setTimeout> | null = null
  $effect(() => {
    const view = map_view
    if (filter_timeout)
      clearTimeout(filter_timeout)
    filter_timeout = setTimeout(() => {
      bbox_filter = view && view.k >= 2 ? view.bbox : null
    }, 400)
  })

  /** Strictly the dictionaries in view once zoomed; zero in view → the full world strip. */
  const displayed = $derived.by(() => {
    if (!bbox_filter)
      return order
    const inside = order.filter(card => card.lng !== null && card.lat !== null
      && bbox_contains({ bbox: bbox_filter, lng: card.lng, lat: card.lat }))
    return inside.length ? inside : order
  })

  /** Duplicate the track when it can loop seamlessly (enough cards to overflow). */
  const LOOP_MIN = 8
  const looped = $derived(displayed.length >= LOOP_MIN ? [...displayed, ...displayed] : displayed)

  function set_active(id: string | null) {
    hovered_id = id
    const card = displayed.find(item => item.id === (id ?? playing_id))
    on_active_dict?.(card?.dict_id ?? null)
  }

  function toggle_audio(event: MouseEvent, card: FeaturedCard) {
    event.preventDefault()
    event.stopPropagation()
    if (playing_id === card.id) {
      audio_element?.pause()
      playing_id = null
      on_active_dict?.(hovered_id ? displayed.find(item => item.id === hovered_id)?.dict_id ?? null : null)
      return
    }
    audio_element?.pause()
    audio_element = new Audio(url_from_storage_path(card.audio_storage_path, PUBLIC_STORAGE_BUCKET))
    const finish = () => {
      if (playing_id === card.id) {
        playing_id = null
        on_active_dict?.(null)
      }
    }
    audio_element.onended = finish
    audio_element.onerror = finish
    playing_id = card.id
    on_active_dict?.(card.dict_id)
    void audio_element.play()
  }

  // --- auto-drift (pauses on hover/touch/focus/audio; off under reduced motion) ---
  let paused = $state(false)
  let touch_resume_timeout: ReturnType<typeof setTimeout> | null = null

  onMount(() => {
    reduced_motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced_motion)
      return

    let raf = 0
    let last = performance.now()
    const SPEED = 14 // px/s
    // float accumulator — scrollLeft rounds to integers, so sub-pixel += would stall
    let drift_position: number | null = null

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      const should_drift = !paused && !playing_id && !hovered_id && !document.hidden
      if (should_drift && scroller && scroller.scrollWidth > scroller.clientWidth * 1.5) {
        if (drift_position === null || Math.abs(scroller.scrollLeft - drift_position) > 2)
          drift_position = scroller.scrollLeft // first frame or the user scrolled manually
        drift_position += SPEED * dt
        const half = scroller.scrollWidth / 2
        if (drift_position >= half)
          drift_position -= half
        scroller.scrollLeft = drift_position
      } else {
        drift_position = null
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  })

  function on_touchstart() {
    paused = true
    if (touch_resume_timeout)
      clearTimeout(touch_resume_timeout)
  }

  function on_touchend() {
    if (touch_resume_timeout)
      clearTimeout(touch_resume_timeout)
    touch_resume_timeout = setTimeout(() => paused = false, 4000)
  }

  // A plain left-click opens the fullscreen image viewer instead of navigating —
  // entering a dictionary kicks off its whole snapshot download, which most
  // curious homepage clicks don't intend. Modified/middle clicks keep the
  // default open-in-new-tab behavior.
  let fullscreen_card = $state<FeaturedCard | null>(null)
  function open_fullscreen(event: MouseEvent, card: FeaturedCard) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
      return
    event.preventDefault()
    audio_element?.pause()
    playing_id = null
    fullscreen_card = card
    on_active_dict?.(card.dict_id)
  }

  /**
   * Anchor points (viewport coords) of the cards currently visible in the
   * scroller — the hero line overlay draws from these to the map dots.
   */
  export function get_visible_card_anchors(): { card: FeaturedCard, x: number, y: number, index: number, offset_cards: number, active: boolean }[] {
    if (!scroller)
      return []
    const scroller_rect = scroller.getBoundingClientRect()
    const strip_center = scroller_rect.left + scroller_rect.width / 2
    const anchors = []
    for (const child of scroller.children) {
      const element = child as HTMLElement
      const rect = element.getBoundingClientRect()
      if (rect.right < scroller_rect.left + 10 || rect.left > scroller_rect.right - 10)
        continue
      const index = Number(element.dataset.index)
      const card = looped[index]
      if (!card || card.lng === null || card.lat === null)
        continue
      const { id } = card
      const card_center = rect.left + rect.width / 2
      anchors.push({
        card,
        x: card_center,
        y: rect.top,
        index,
        // signed distance from the strip midpoint, in card widths (gap included)
        offset_cards: (card_center - strip_center) / (rect.width + 12),
        active: hovered_id === id || playing_id === id,
      })
    }
    return anchors
  }
</script>

<!-- preload=off: "tap" preloads on MOUSEDOWN, so even opening the fullscreen viewer
     (which cancels navigation) would start pulling that dictionary's whole DB.
     Downloads should only start from the fullscreen viewer's own links. -->
<div
  class="strip"
  data-sveltekit-preload-data="off"
  bind:this={scroller}
  onpointerenter={() => paused = true}
  onpointerleave={() => { paused = false; set_active(null) }}
  ontouchstart={on_touchstart}
  ontouchend={on_touchend}
  onfocusin={() => paused = true}
  onfocusout={() => paused = false}>
  {#each looped as card, index (`${card.id}-${index}`)}
    <a
      class="card"
      data-index={index}
      href="/{card.dict_url}/entry/{card.entry_id}"
      onclick={event => open_fullscreen(event, card)}
      onpointerenter={() => set_active(card.id)}
      onpointerleave={() => set_active(null)}
      onfocus={() => set_active(card.id)}
      onblur={() => set_active(null)}>
      <img src={image_src(card.photo_serving_url, 's340-p')} alt={card.lexeme} loading={index < 8 ? 'eager' : 'lazy'} />
      <div class="fade"></div>
      <div class="text">
        <div class="dict-name">{card.dict_name}</div>
        <div class="lexeme">{card.lexeme}</div>
        {#if card.gloss}
          <div class="gloss">{card.gloss}</div>
        {/if}
      </div>
      <button
        type="button"
        class="play"
        onclick={event => toggle_audio(event, card)}
        aria-label="{playing_id === card.id ? 'Pause' : 'Play'} {card.lexeme}">
        {#if playing_id === card.id}<IconMdiPause />{:else}<IconMdiPlay />{/if}
      </button>
    </a>
  {/each}
</div>

{#if fullscreen_card}
  <FeaturedEntryFullscreen card={fullscreen_card} on_close={() => { fullscreen_card = null; on_active_dict?.(null) }} />
{/if}

<style>
  .strip {
    display: flex;
    gap: 0.75rem;
    overflow-x: auto;
    width: 100%;
    padding: 0.875rem 0 0.375rem;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }

  .strip::-webkit-scrollbar {
    display: none;
  }

  .card {
    position: relative;
    flex-shrink: 0;
    width: 10.625rem;
    height: 10.625rem;
    border-radius: 0.875rem;
    overflow: hidden;
    background: var(--surface);
    text-decoration: none;
    transition: transform 200ms;
  }

  @media (max-width: 640px) {
    .card {
      width: 8.75rem;
      height: 8.75rem;
    }
  }

  .card:hover {
    transform: translateY(-3px);
  }

  .card:active {
    transform: scale(0.975);
  }

  .card img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .fade {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgb(0 0 0 / 0.78) 0%, rgb(0 0 0 / 0.28) 38%, transparent 62%);
  }

  .text {
    position: absolute;
    left: 0.625rem;
    right: 2.75rem;
    bottom: 0.5rem;
    color: white;
  }

  .dict-name {
    font-size: 0.5625rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    opacity: 0.75;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .lexeme {
    font-weight: 700;
    font-size: 1rem;
    line-height: 1.25;
    text-shadow: 0 1px 2px rgb(0 0 0 / 0.55);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .gloss {
    font-size: 0.75rem;
    opacity: 0.9;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .play {
    position: absolute;
    right: 0.4375rem;
    bottom: 0.4375rem;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border: none;
    border-radius: 9999px;
    background: rgb(255 255 255 / 0.22);
    backdrop-filter: blur(4px);
    color: white;
    font-size: 1rem;
    cursor: pointer;
    transition: background 200ms, transform 75ms;
  }

  .play:hover {
    background: rgb(255 255 255 / 0.42);
  }

  .play:active {
    transform: scale(0.88);
  }
</style>
