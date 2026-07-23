<script lang="ts">
  import type { FeaturedCard } from './types'
  import { onMount } from 'svelte'
  import { fade } from 'svelte/transition'
  import { PUBLIC_STORAGE_BUCKET } from '$env/static/public'
  import { page } from '$app/state'
  import { photo_src, url_from_storage_path } from '$lib/utils/media-url'
  import { portal } from '$lib/utils/portal'
  import IconMdiClose from '~icons/mdi/close'
  import IconMaterialSymbolsHearing from '~icons/material-symbols/hearing'
  import IconMdiArrowRight from '~icons/mdi/arrow-right'
  import IconMdiBookOpenPageVariantOutline from '~icons/mdi/book-open-page-variant-outline'

  type CrossfadeFns = ReturnType<typeof import('svelte/transition').crossfade>

  interface Props {
    card: FeaturedCard
    /** Shared crossfade transition + key so the tapped card image morphs into this viewer. */
    send: CrossfadeFns[0]
    receive: CrossfadeFns[1]
    crossfade_key: string | null
    on_close: () => void
  }

  const { card, send, receive, crossfade_key, on_close }: Props = $props()
  const t = $derived(page.data.t)

  let playing = $state(false)
  let audio_element: HTMLAudioElement | null = null
  function toggle_audio(event: MouseEvent) {
    event.stopPropagation()
    if (!audio_element)
      return
    if (playing) {
      audio_element.pause()
      playing = false
      return
    }
    playing = true
    void audio_element.play()
  }

  function close() {
    audio_element?.pause()
    on_close()
  }

  onMount(() => {
    document.body.style.overflow = 'hidden'
    // Opening the image is very likely followed by a play tap — warm the audio now.
    audio_element = new Audio(url_from_storage_path(card.audio_storage_path, PUBLIC_STORAGE_BUCKET))
    audio_element.preload = 'auto'
    audio_element.onended = () => playing = false
    audio_element.onerror = () => playing = false
    return () => {
      audio_element?.pause()
      document.body.style.overflow = 'auto'
    }
  })
</script>

<svelte:window onkeydown={(event) => { if (event.key === 'Escape') close() }} />

<!-- preload=tap on the entry link: hover/eager-preloading it would start pulling
     that whole dictionary's snapshot — which just viewing the photo shouldn't do. -->
<div use:portal class="fullscreen-root" data-sveltekit-preload-data="tap">
  <button type="button" class="backdrop" aria-label={t('misc.cancel')} onclick={close} transition:fade={{ duration: 150 }}></button>

  <div class="top-bar" transition:fade={{ duration: 150 }}>
    <a class="dict-name" href="/{card.dict_url}">
      <IconMdiBookOpenPageVariantOutline class="book-icon" />
      {card.dict_name}
    </a>
    <button type="button" class="icon-btn" aria-label={t('misc.cancel')} onclick={close}>
      <IconMdiClose />
    </button>
  </div>

  <img
    class="image"
    src={photo_src({ storage_path: card.photo_storage_path, serving_url: card.photo_serving_url }, 'w1200')}
    alt={card.lexeme}
    in:receive={{ key: crossfade_key }}
    out:send={{ key: crossfade_key }} />

  <div class="bottom-bar" transition:fade={{ duration: 150 }}>
    <div class="word-group">
      <button
        type="button"
        class="audio-btn"
        class:playing
        onclick={toggle_audio}
        aria-label="{playing ? t('misc.pause') : t('misc.play')} {card.lexeme}">
        <IconMaterialSymbolsHearing />
      </button>
      <a class="word" href="/{card.dict_url}/entry/{card.entry_id}">
        <span class="lexeme">{card.lexeme}</span>
        {#if card.gloss}<span class="gloss">{card.gloss}</span>{/if}
      </a>
    </div>
    <a class="btn-primary btn-default open-entry" href="/{card.dict_url}/entry/{card.entry_id}">
      {t('home_v2.open_entry')} <IconMdiArrowRight />
    </a>
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
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    min-width: 0;
    font-weight: 600;
    font-size: 1rem;
    color: #fff;
    text-decoration: none;
    text-shadow: 0 1px 3px rgb(0 0 0 / 0.6);
    white-space: nowrap;
  }

  .dict-name :global(.book-icon) {
    flex-shrink: 0;
    font-size: 1em;
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

  .word-group {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }

  .word {
    min-width: 0;
    color: #fff;
    text-decoration: none;
  }

  .word:hover .lexeme {
    text-decoration: underline;
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

  .audio-btn {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 3rem;
    height: 3rem;
    border: none;
    border-radius: 9999px;
    background: rgb(255 255 255 / 0.24);
    backdrop-filter: blur(4px);
    color: #fff;
    font-size: 1.5rem;
    cursor: pointer;
    transition: background 200ms, transform 75ms;
  }

  .audio-btn:hover,
  .audio-btn.playing {
    background: rgb(255 255 255 / 0.42);
  }

  .audio-btn:active {
    transform: scale(0.9);
  }

  .open-entry {
    flex-shrink: 0;
    gap: 0.375rem;
    white-space: nowrap;
  }
</style>
