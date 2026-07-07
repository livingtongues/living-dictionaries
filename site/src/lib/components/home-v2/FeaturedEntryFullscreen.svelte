<script lang="ts">
  import type { FeaturedCard } from './types'
  import { onMount } from 'svelte'
  import { fade } from 'svelte/transition'
  import { PUBLIC_STORAGE_BUCKET } from '$env/static/public'
  import { page } from '$app/state'
  import { image_src, url_from_storage_path } from '$lib/utils/media-url'
  import { portal } from '$lib/utils/portal'
  import IconMdiClose from '~icons/mdi/close'
  import IconMdiPlay from '~icons/mdi/play'
  import IconMdiPause from '~icons/mdi/pause'
  import IconMdiArrowRight from '~icons/mdi/arrow-right'

  interface Props {
    card: FeaturedCard
    on_close: () => void
  }

  const { card, on_close }: Props = $props()
  const t = $derived(page.data.t)

  let playing = $state(false)
  let audio_element: HTMLAudioElement | null = null
  function toggle_audio(event: MouseEvent) {
    event.stopPropagation()
    if (playing) {
      audio_element?.pause()
      playing = false
      return
    }
    audio_element = new Audio(url_from_storage_path(card.audio_storage_path, PUBLIC_STORAGE_BUCKET))
    audio_element.onended = () => playing = false
    audio_element.onerror = () => playing = false
    playing = true
    void audio_element.play()
  }

  function close() {
    audio_element?.pause()
    on_close()
  }

  onMount(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      audio_element?.pause()
      document.body.style.overflow = 'auto'
    }
  })
</script>

<svelte:window onkeydown={(event) => { if (event.key === 'Escape') close() }} />

<!-- preload=tap on the entry link: hover/eager-preloading it would start pulling
     that whole dictionary's snapshot — which just viewing the photo shouldn't do. -->
<div use:portal class="fullscreen-root" transition:fade={{ duration: 150 }} data-sveltekit-preload-data="tap">
  <button type="button" class="backdrop" aria-label={t('misc.cancel')} onclick={close}></button>

  <div class="top-bar">
    <a class="dict-name" href="/{card.dict_url}">{card.dict_name}</a>
    <button type="button" class="icon-btn" aria-label={t('misc.cancel')} onclick={close}>
      <IconMdiClose />
    </button>
  </div>

  <img class="image" src={image_src(card.photo_serving_url, 'w1200')} alt={card.lexeme} />

  <div class="bottom-bar">
    <div class="word">
      <span class="lexeme">{card.lexeme}</span>
      {#if card.gloss}<span class="gloss">{card.gloss}</span>{/if}
    </div>
    <div class="actions">
      <button
        type="button"
        class="audio-btn"
        onclick={toggle_audio}
        aria-label="{playing ? t('misc.pause') : t('misc.play')} {card.lexeme}">
        {#if playing}<IconMdiPause />{:else}<IconMdiPlay />{/if}
      </button>
      <a class="btn-primary btn-default open-entry" href="/{card.dict_url}/entry/{card.entry_id}">
        {t('home_v2.open_entry')} <IconMdiArrowRight />
      </a>
    </div>
  </div>
</div>

<style>
  .fullscreen-root {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .backdrop {
    position: absolute;
    inset: 0;
    border: none;
    background: rgb(0 0 0 / 0.9);
    cursor: zoom-out;
  }

  .image {
    position: relative;
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    pointer-events: none;
  }

  .top-bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: linear-gradient(to bottom, rgb(0 0 0 / 0.55), transparent);
    color: #fff;
  }

  .dict-name {
    font-weight: 600;
    font-size: 1rem;
    color: #fff;
    text-decoration: none;
    text-shadow: 0 1px 3px rgb(0 0 0 / 0.6);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dict-name:hover {
    text-decoration: underline;
  }

  .icon-btn {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    border: none;
    border-radius: 50%;
    background: rgb(0 0 0 / 0.4);
    color: #fff;
    cursor: pointer;
    font-size: 1.375rem;
  }

  .icon-btn:hover {
    background: rgb(0 0 0 / 0.7);
  }

  .bottom-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 2;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.5rem 1rem 1.25rem;
    background: linear-gradient(to top, rgb(0 0 0 / 0.72), transparent);
    color: #fff;
  }

  .word {
    min-width: 0;
  }

  .lexeme {
    display: block;
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    text-shadow: 0 1px 3px rgb(0 0 0 / 0.6);
  }

  .gloss {
    display: block;
    margin-top: 0.125rem;
    font-size: 0.9375rem;
    opacity: 0.9;
  }

  .actions {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .audio-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.75rem;
    height: 2.75rem;
    border: none;
    border-radius: 9999px;
    background: rgb(255 255 255 / 0.24);
    backdrop-filter: blur(4px);
    color: #fff;
    font-size: 1.375rem;
    cursor: pointer;
    transition: background 200ms, transform 75ms;
  }

  .audio-btn:hover {
    background: rgb(255 255 255 / 0.42);
  }

  .audio-btn:active {
    transform: scale(0.9);
  }

  .open-entry {
    gap: 0.375rem;
    white-space: nowrap;
  }
</style>
