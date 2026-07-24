<script lang="ts">
  import { crossfade, fade, scale } from 'svelte/transition'
  import { page } from '$app/state'
  import type { PhotoLike } from '$lib/utils/media-url'
  import { photo_src } from '$lib/utils/media-url'
  import IconGgSpinner from '~icons/gg/spinner'
  import IconTablerAi from '~icons/tabler/ai'
  import IconMdiClose from '~icons/mdi/close'
  import IconMdiArrowRight from '~icons/mdi/arrow-right'
  import IconMdiChevronLeft from '~icons/mdi/chevron-left'
  import IconMdiChevronRight from '~icons/mdi/chevron-right'
  import IconMdiTrashCanOutline from '~icons/mdi/trash-can-outline'
  import IconMdiCameraOutline from '~icons/mdi/camera-outline'

  interface GalleryPhoto extends PhotoLike {
    id?: string
    source?: string | null
    photographer?: string | null
  }

  interface Props {
    title: string
    photo: PhotoLike
    /**
     * Full photo set for viewer navigation (prev/next + arrow keys). The thumb
     * still renders `photo`; the viewer opens at its position in this array.
     */
    photos?: GalleryPhoto[]
    can_edit?: boolean
    square?: number
    width?: number
    height?: number
    photo_source?: string
    photographer?: string
    /** Entry (or other detail) page — renders the viewer title as a link. */
    href?: string
    /** Secondary line under the viewer title (e.g. the entry's gloss). */
    subtitle?: string
    /** Receives the id of the photo currently shown in the viewer (single-photo callers can ignore it). */
    on_delete_image: (photo_id?: string) => Promise<any>
  }

  const {
    title,
    photo,
    photos = undefined,
    can_edit = false,
    square = undefined,
    width = undefined,
    height = undefined,
    photo_source = undefined,
    photographer = undefined,
    href = undefined,
    subtitle = undefined,
    on_delete_image,
  }: Props = $props()

  const [send, receive] = crossfade({
    duration: 200,
    fallback: scale,
  })
  const key = {}

  let windowWidth: number = $state()
  let loading = $state(false)
  let viewing = $state(false)
  let view_index = $state(0)

  const gallery = $derived(photos && photos.length > 1 ? photos : null)
  // Clamp against live deletes shrinking the array while the viewer is open.
  const safe_index = $derived(gallery ? Math.min(view_index, gallery.length - 1) : 0)
  const current = $derived(gallery ? gallery[safe_index] : photo)
  const current_source = $derived(gallery ? gallery[safe_index]?.source : photo_source)
  const current_photographer = $derived(gallery ? gallery[safe_index]?.photographer : photographer)

  const isDesktop = $derived(windowWidth >= 768)
  const fullscreenSource = $derived(photo_src(current, `w${isDesktop ? windowWidth - 24 : windowWidth}`))

  function step_gallery(delta: number) {
    if (!gallery) return
    view_index = (safe_index + delta + gallery.length) % gallery.length
  }

  function load() {
    view_index = gallery ? Math.max(0, gallery.indexOf(photo as GalleryPhoto)) : 0
    const timeout = setTimeout(() => (loading = true), 100)
    const img = new Image()

    img.onload = () => {
      clearTimeout(timeout)
      loading = false
      viewing = true
    }

    img.src = photo_src(photo, `w${isDesktop ? windowWidth - 24 : windowWidth}`)
  }
</script>

<svelte:window
  bind:innerWidth={windowWidth}
  onkeydown={(e) => {
    if (!viewing) return
    if (e.key === 'Escape') viewing = false
    else if (e.key === 'ArrowLeft') step_gallery(-1)
    else if (e.key === 'ArrowRight') step_gallery(1)
  }} />

<div class="image-wrap">
  {#if !viewing}
    <img
      class="thumb"
      onclick={load}
      in:receive={{ key }}
      out:send={{ key }}
      alt={title}
      src={photo_src(photo, square
        ? `s${square}-p`
        : width
        ? `w${width}`
        : height
        ? `h${height}`
        : 's0')} />
    {#if loading}
      <IconGgSpinner class="spinner" />
    {:else if photographer === 'AI'}
      <IconTablerAi class="ai-badge" style="font-size: 1.5rem" />
    {/if}
  {/if}
</div>

{#if viewing}
  <div onclick={() => viewing = false} class="viewer">
    <div class="viewer-backdrop" transition:fade={{ duration: 200 }}></div>
    <img class="full-img" in:receive={{ key }} out:send={{ key }} alt="Image of {title}" src={fullscreenSource} />
    <div class="viewer-header" transition:fade={{ duration: 150 }}>
      <div class="title-block" onclick={e => e.stopPropagation()}>
        {#if href}
          <a class="title-link" {href}>
            {title}
            <IconMdiArrowRight class="title-arrow" />
          </a>
        {:else}
          <div class="viewer-title">{title}</div>
        {/if}
        {#if subtitle}
          <div class="viewer-subtitle">{subtitle}</div>
        {/if}
        {#if gallery}
          <div class="gallery-badge">{safe_index + 1} / {gallery.length}</div>
        {/if}
      </div>
      <button type="button" class="viewer-button" aria-label={page.data.t('misc.cancel')} onclick={() => viewing = false}>
        <IconMdiClose style="font-size: 1.375rem" />
      </button>
    </div>
    {#if gallery}
      <button type="button" class="viewer-button gallery-nav prev" aria-label="Previous image" onclick={(e) => { e.stopPropagation(); step_gallery(-1) }}>
        <IconMdiChevronLeft style="font-size: 1.625rem" />
      </button>
      <button type="button" class="viewer-button gallery-nav next" aria-label="Next image" onclick={(e) => { e.stopPropagation(); step_gallery(1) }}>
        <IconMdiChevronRight style="font-size: 1.625rem" />
      </button>
    {/if}
    {#if current_source || current_photographer || can_edit}
      <div class="viewer-footer" transition:fade={{ duration: 150 }}>
        <div class="credit" onclick={e => e.stopPropagation()}>
          {#if current_photographer === 'AI'}
            <span class="ai-chip"><IconTablerAi style="font-size: 1.375rem" /> generated</span>
          {:else if current_photographer}
            <span class="credit-line"><IconMdiCameraOutline style="opacity: 0.7" /> {current_photographer}</span>
          {/if}
          {#if current_source}
            <span class="credit-line source">{current_source}</span>
          {/if}
        </div>
        {#if can_edit}
          <button
            type="button"
            class="viewer-button delete"
            onclick={async (e) => {
              e.stopPropagation()
              if (confirm(page.data.t('entry.delete_image')))
                await on_delete_image(gallery ? gallery[safe_index]?.id : undefined)
            }}>
            <IconMdiTrashCanOutline style="font-size: 1.125rem" />
            {page.data.t('misc.delete')}
          </button>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .image-wrap {
    height: 100%;
    width: 100%;
    position: relative;
  }

  .thumb {
    height: 100%;
    width: 100%;
    object-fit: cover;
    cursor: pointer;
  }

  .image-wrap :global(.spinner) {
    position: absolute;
    bottom: 0.25rem;
    right: 0.25rem;
    z-index: 1; /* above the gallery card's scrim/text overlays */
    color: #fff;
    filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.6));
    animation: image-spin 1s linear infinite;
  }

  @keyframes image-spin {
    from {
      transform: rotate(0deg);
    }

    to {
      transform: rotate(360deg);
    }
  }

  .image-wrap :global(.ai-badge) {
    color: #fff;
    position: absolute;
    bottom: 0.25rem;
    left: 0.25rem;
  }

  .viewer {
    position: fixed;
    inset: 0;
    z-index: 51;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
  }

  /* Separate layer so it can fade while the image zooms. */
  .viewer-backdrop {
    position: absolute;
    inset: 0;
    background: rgb(0 0 0 / 0.88);
    backdrop-filter: blur(10px);
  }

  .full-img {
    position: relative;
    object-fit: contain;
    max-height: 100%;
    max-width: 100%;
    will-change: transform, opacity;
  }

  /* Top/bottom bars float over the photo on soft gradients — no chrome boxes. */
  .viewer-header,
  .viewer-footer {
    position: absolute;
    left: 0;
    right: 0;
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.875rem 1rem;
  }

  .viewer-header {
    top: 0;
    align-items: flex-start;
    background: linear-gradient(to bottom, rgb(0 0 0 / 0.65), rgb(0 0 0 / 0));
    padding-bottom: 2.5rem;
  }

  .viewer-footer {
    bottom: 0;
    align-items: flex-end;
    background: linear-gradient(to top, rgb(0 0 0 / 0.65), rgb(0 0 0 / 0));
    padding-top: 2.5rem;
  }

  .title-block {
    min-width: 0;
    text-shadow: 0 1px 3px rgb(0 0 0 / 0.6);
  }

  .viewer-title,
  .title-link {
    font-weight: 700;
    font-size: 1.25rem;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }

  .title-link {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    color: #fff;
    text-decoration: none;
  }

  .title-link :global(.title-arrow) {
    font-size: 1rem;
    opacity: 0.6;
    transition: transform 200ms, opacity 200ms;
  }

  .title-link:hover {
    text-decoration: underline;
    text-underline-offset: 0.25em;
  }

  .title-link:hover :global(.title-arrow) {
    opacity: 1;
    transform: translateX(3px);
  }

  .viewer-subtitle {
    font-size: 0.875rem;
    opacity: 0.8;
  }

  .gallery-badge {
    display: inline-block;
    margin-top: 0.375rem;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    background: rgb(255 255 255 / 0.15);
    backdrop-filter: blur(4px);
    font-size: 0.75rem;
    font-weight: 500;
  }

  .gallery-nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 1;
    width: 2.75rem;
    height: 2.75rem;
    padding: 0;
  }

  .gallery-nav:active {
    transform: translateY(-50%) scale(0.93);
  }

  .gallery-nav.prev {
    left: 0.75rem;
  }

  .gallery-nav.next {
    right: 0.75rem;
  }

  .viewer-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    flex-shrink: 0;
    min-width: 2.5rem;
    min-height: 2.5rem;
    padding: 0 0.625rem;
    border: none;
    border-radius: 9999px;
    background: rgb(255 255 255 / 0.15);
    backdrop-filter: blur(4px);
    color: #fff;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 200ms, transform 75ms;
  }

  .viewer-button:hover {
    background: rgb(255 255 255 / 0.3);
  }

  .viewer-button:active {
    transform: scale(0.93);
  }

  .viewer-button.delete:hover {
    background: color-mix(in srgb, var(--danger), transparent 25%);
  }

  .credit {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
    font-size: 0.8125rem;
    text-shadow: 0 1px 3px rgb(0 0 0 / 0.6);
  }

  .credit-line {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
  }

  .credit-line.source {
    opacity: 0.75;
  }

  .ai-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.625rem;
    border-radius: 9999px;
    background: rgb(255 255 255 / 0.15);
    backdrop-filter: blur(4px);
    font-size: 0.75rem;
  }
</style>
