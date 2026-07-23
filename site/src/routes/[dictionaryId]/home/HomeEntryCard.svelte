<script lang="ts">
  import { PUBLIC_STORAGE_BUCKET } from '$env/static/public'
  import { photo_src, url_from_storage_path } from '$lib/utils/media-url'
  import { create_exclusive_audio } from '$lib/utils/exclusive-audio.svelte'
  import { card_hue } from './home-helpers'
  import IconMaterialSymbolsHearing from '~icons/material-symbols/hearing'
  import IconMdiStarOff from '~icons/mdi/star-off'
  import IconMdiChevronLeft from '~icons/mdi/chevron-left'
  import IconMdiChevronRight from '~icons/mdi/chevron-right'
  import { page } from '$app/state'

  interface Manage {
    can_move_left: boolean
    can_move_right: boolean
    on_move_left: () => void
    on_move_right: () => void
    on_unstar: () => void
  }

  interface Props {
    href: string
    entry_id: string
    lexeme: string
    /** First alternate orthography (headword's excluded). */
    alt?: string | null
    phonetic?: string | null
    /** Translated parts-of-speech abbreviations, already period/comma formatted. */
    pos?: string | null
    glosses?: string[]
    dialect?: string | null
    photo_serving_url?: string | null
    photo_storage_path?: string | null
    audio_storage_path?: string | null
    manage?: Manage | null
    /** Touch devices have no hover — the strip's mobile edit toggle forces the manage controls visible. */
    force_manage?: boolean
  }

  const {
    href,
    entry_id,
    lexeme,
    alt = null,
    phonetic = null,
    pos = null,
    glosses = [],
    dialect = null,
    photo_serving_url = null,
    photo_storage_path = null,
    audio_storage_path = null,
    manage = null,
    force_manage = false,
  }: Props = $props()

  const sparse = $derived(!alt && !phonetic && !pos && !glosses.length && !dialect)

  const has_photo = $derived(!!(photo_serving_url || photo_storage_path))

  const audio = create_exclusive_audio()

  function toggle_audio(event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    if (audio_storage_path)
      audio.toggle(url_from_storage_path(audio_storage_path, PUBLIC_STORAGE_BUCKET))
  }

  function manage_click(event: MouseEvent, action: () => void) {
    event.preventDefault()
    event.stopPropagation()
    action()
  }
</script>

<a class="card" class:has-photo={has_photo} {href} style:--hue={card_hue(entry_id)}>
  {#if has_photo}
    <img src={photo_src({ storage_path: photo_storage_path, serving_url: photo_serving_url }, 's340-p')} alt={lexeme} loading="lazy" />
    <div class="scrim"></div>
  {/if}
  <div class="content" class:sparse>
    {#if dialect}
      <span class="dialect">{dialect}</span>
    {/if}
    <div class="lexeme" class:solo={sparse}>{lexeme}</div>
    {#if alt}
      <div class="alt">{alt}</div>
    {/if}
    {#if phonetic}
      <div class="phonetic">[{phonetic}]</div>
    {/if}
    {#if !sparse}
      <div class="spacer"></div>
      <div class="bottom" class:room-for-ear={!!audio_storage_path}>
        {#if pos}
          <div class="pos">{pos}</div>
        {/if}
        {#each glosses as gloss, index (index)}
          <div class="gloss" class:secondary={index > 0}>{gloss}</div>
        {/each}
      </div>
    {/if}
  </div>
  {#if audio_storage_path}
    <button
      type="button"
      class="overlay-button play"
      class:playing={audio.playing}
      onclick={toggle_audio}
      aria-label="{audio.playing ? page.data.t('misc.pause') : page.data.t('misc.play')} {lexeme}">
      <IconMaterialSymbolsHearing />
    </button>
  {/if}
  {#if manage}
    <div class="manage" class:force-visible={force_manage}>
      <button
        type="button"
        class="overlay-button"
        disabled={!manage.can_move_left}
        onclick={event => manage_click(event, manage.on_move_left)}
        title={page.data.t('dict_home.move_left')}
        aria-label={page.data.t('dict_home.move_left')}>
        <IconMdiChevronLeft />
      </button>
      <button
        type="button"
        class="overlay-button"
        onclick={event => manage_click(event, manage.on_unstar)}
        title={page.data.t('dict_home.unstar')}
        aria-label={page.data.t('dict_home.unstar')}>
        <IconMdiStarOff />
      </button>
      <button
        type="button"
        class="overlay-button"
        disabled={!manage.can_move_right}
        onclick={event => manage_click(event, manage.on_move_right)}
        title={page.data.t('dict_home.move_right')}
        aria-label={page.data.t('dict_home.move_right')}>
        <IconMdiChevronRight />
      </button>
    </div>
  {/if}
</a>

<style>
  .card {
    display: block;
    position: relative;
    flex-shrink: 0;
    width: 10.625rem;
    height: 10.625rem;
    border-radius: 0.875rem;
    overflow: hidden;
    background: linear-gradient(135deg, hsl(var(--hue) 18% 36%), hsl(calc(var(--hue) + 40) 22% 25%));
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

  /* Full-card scrim so the top text block reads over any photo, heavier at the base. */
  .scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, rgb(0 0 0 / 0.42), rgb(0 0 0 / 0.14) 40%, rgb(0 0 0 / 0.3) 62%, rgb(0 0 0 / 0.78));
  }

  .content {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 0.625rem 0.625rem 0.5rem;
    color: white;
  }

  .content.sparse {
    justify-content: center;
    align-items: center;
    text-align: center;
  }

  .has-photo .content {
    text-shadow: 0 1px 2px rgb(0 0 0 / 0.55);
  }

  .dialect {
    font-size: 0.5625rem;
    letter-spacing: 0.04em;
    padding: 0.125rem 0.4375rem;
    border-radius: 9999px;
    background: rgb(255 255 255 / 0.16);
    backdrop-filter: blur(4px);
    margin-bottom: 0.3125rem;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .lexeme {
    font-weight: 700;
    font-size: 1.0625rem;
    line-height: 1.15;
    overflow-wrap: anywhere;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .lexeme.solo {
    font-size: 1.1875rem;
    -webkit-line-clamp: 4;
  }

  .alt {
    font-size: 0.75rem;
    opacity: 0.8;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }

  .phonetic {
    font-size: 0.75rem;
    font-style: italic;
    opacity: 0.72;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }

  .spacer {
    flex-grow: 1;
  }

  .bottom {
    max-width: 100%;
  }

  .bottom.room-for-ear {
    padding-right: 2.125rem;
  }

  .pos {
    font-size: 0.625rem;
    font-style: italic;
    opacity: 0.6;
  }

  .gloss {
    font-size: 0.78125rem;
    opacity: 0.95;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .gloss.secondary {
    opacity: 0.7;
  }

  .overlay-button {
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
    transition: background 200ms, transform 75ms, opacity 200ms;
  }

  .overlay-button:hover,
  .overlay-button.playing {
    background: rgb(255 255 255 / 0.42);
  }

  .overlay-button:active {
    transform: scale(0.88);
  }

  .play {
    position: absolute;
    right: 0.4375rem;
    bottom: 0.4375rem;
  }

  .manage {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    opacity: 0;
    pointer-events: none; /* invisible buttons must not swallow taps meant for the card link */
    transition: opacity 200ms;
  }

  .card:hover .manage,
  .card:focus-within .manage,
  .manage.force-visible {
    opacity: 1;
    pointer-events: auto;
  }
</style>
