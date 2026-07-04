<script lang="ts" module>
  /** One card plays at a time across every strip on the page. */
  let stop_current_audio: (() => void) | null = null
</script>

<script lang="ts">
  import { PUBLIC_STORAGE_BUCKET } from '$env/static/public'
  import { image_src, url_from_storage_path } from '$lib/utils/media-url'
  import { card_hue } from './home-helpers'
  import IconMdiPlay from '~icons/mdi/play'
  import IconMdiPause from '~icons/mdi/pause'
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
    gloss?: string | null
    photo_serving_url?: string | null
    audio_storage_path?: string | null
    manage?: Manage | null
  }

  const { href, entry_id, lexeme, gloss = null, photo_serving_url = null, audio_storage_path = null, manage = null }: Props = $props()

  let playing = $state(false)
  let audio_element: HTMLAudioElement | null = null

  function stop() {
    audio_element?.pause()
    playing = false
  }

  function toggle_audio(event: MouseEvent) {
    event.preventDefault()
    event.stopPropagation()
    if (!audio_storage_path)
      return
    if (playing) {
      stop()
      stop_current_audio = null
      return
    }
    stop_current_audio?.()
    stop_current_audio = stop
    audio_element = new Audio(url_from_storage_path(audio_storage_path, PUBLIC_STORAGE_BUCKET))
    audio_element.onended = stop
    audio_element.onerror = stop
    playing = true
    void audio_element.play()
  }

  function manage_click(event: MouseEvent, action: () => void) {
    event.preventDefault()
    event.stopPropagation()
    action()
  }
</script>

<a class="card" {href} style:--hue={card_hue(entry_id)}>
  {#if photo_serving_url}
    <img src={image_src(photo_serving_url, 's340-p')} alt={lexeme} loading="lazy" />
  {/if}
  <div class="fade"></div>
  <div class="text">
    <div class="lexeme">{lexeme}</div>
    {#if gloss}
      <div class="gloss">{gloss}</div>
    {/if}
  </div>
  {#if audio_storage_path}
    <button
      type="button"
      class="overlay-button play"
      onclick={toggle_audio}
      aria-label="{playing ? 'Pause' : 'Play'} {lexeme}">
      {#if playing}<IconMdiPause />{:else}<IconMdiPlay />{/if}
    </button>
  {/if}
  {#if manage}
    <div class="manage">
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
    background: linear-gradient(135deg, hsl(var(--hue) 35% 38%), hsl(calc(var(--hue) + 40) 45% 26%));
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

  .overlay-button:hover {
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
    top: 0.4375rem;
    left: 0.4375rem;
    right: 0.4375rem;
    display: flex;
    justify-content: space-between;
    opacity: 0;
    transition: opacity 200ms;
  }

  .card:hover .manage,
  .card:focus-within .manage {
    opacity: 1;
  }

  /* Touch devices have no hover — keep the manage controls visible. */
  @media (hover: none) {
    .manage {
      opacity: 1;
    }
  }
</style>
