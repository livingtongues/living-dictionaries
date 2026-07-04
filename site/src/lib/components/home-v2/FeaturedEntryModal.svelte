<script lang="ts">
  import type { FeaturedCard } from './types'
  import { PUBLIC_STORAGE_BUCKET } from '$env/static/public'
  import { page } from '$app/state'
  import Modal from '$lib/components/ui/Modal.svelte'
  import { image_src, url_from_storage_path } from '$lib/utils/media-url'
  import IconMdiPlay from '~icons/mdi/play'
  import IconMdiPause from '~icons/mdi/pause'
  import IconMdiAccountVoice from '~icons/mdi/account-voice'
  import IconMdiArrowRight from '~icons/mdi/arrow-right'

  interface Props {
    card: FeaturedCard
    on_close: () => void
  }

  const { card, on_close }: Props = $props()
  const t = $derived(page.data.t)

  // Prefer the full glosses snapshot; fall back to the card's single baked gloss
  // (pre-pivot rows lack the modal fields until the next curation backfill).
  const gloss_rows = $derived.by(() => {
    if (card.glosses && Object.keys(card.glosses).length) {
      return Object.entries(card.glosses)
        .filter(([, value]) => value)
        .map(([bcp, value]) => ({ label: t({ dynamicKey: `gl.${bcp}`, fallback: bcp }), value }))
    }
    if (card.gloss)
      return [{ label: card.gloss_language ? t({ dynamicKey: `gl.${card.gloss_language}`, fallback: card.gloss_language }) : '', value: card.gloss }]
    return []
  })

  function first_value(multistring: Record<string, string> | null | undefined): string | null {
    if (!multistring)
      return null
    return Object.values(multistring).find(Boolean) ?? null
  }
  const example_text = $derived(first_value(card.example_sentence?.text))
  const example_translation = $derived(first_value(card.example_sentence?.translation))

  let playing = $state(false)
  let audio_element: HTMLAudioElement | null = null
  function toggle_audio() {
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
  $effect(() => () => audio_element?.pause())
</script>

<!-- preload=tap on the links: hover-preloading either one would start pulling
     that dictionary's whole DB — the reason this modal exists. -->
<Modal on_close={() => { audio_element?.pause(); on_close() }} class="featured-entry-modal">
  <div class="photo-wrap">
    <img src={image_src(card.photo_serving_url, 's600-p')} alt={card.lexeme} />
    <button
      type="button"
      class="play"
      onclick={toggle_audio}
      aria-label="{playing ? 'Pause' : 'Play'} {card.lexeme}">
      {#if playing}<IconMdiPause />{:else}<IconMdiPlay />{/if}
    </button>
  </div>

  <div class="word">
    <span class="lexeme">{card.lexeme}</span>
    {#if card.phonetic}<span class="phonetic">[{card.phonetic}]</span>{/if}
  </div>

  {#if card.speaker_name}
    <div class="speaker"><IconMdiAccountVoice /> {card.speaker_name}</div>
  {/if}

  {#if gloss_rows.length}
    <dl class="glosses">
      {#each gloss_rows as row (row.label + row.value)}
        <div class="gloss-row">
          {#if row.label}<dt>{row.label}</dt>{/if}
          <dd>{row.value}</dd>
        </div>
      {/each}
    </dl>
  {/if}

  {#if example_text}
    <blockquote class="example">
      <div class="example-text">{example_text}</div>
      {#if example_translation}<div class="example-translation">{example_translation}</div>{/if}
    </blockquote>
  {/if}

  <div class="footer" data-sveltekit-preload-data="tap">
    <a class="dict-link" href="/{card.dict_url}">
      <span class="dict-name">{card.dict_name}</span>
      {#if card.dict_location}<span class="dict-location">{card.dict_location}</span>{/if}
    </a>
    <a class="btn-primary btn-default" style="gap: 0.375rem" href="/{card.dict_url}/entry/{card.entry_id}">
      {t('home_v2.open_entry')} <IconMdiArrowRight />
    </a>
  </div>
</Modal>

<style>
  :global(.featured-entry-modal) {
    max-width: 24rem !important;
  }

  .photo-wrap {
    position: relative;
    border-radius: 0.75rem;
    overflow: hidden;
    aspect-ratio: 3 / 2;
    background: var(--surface);
  }

  .photo-wrap img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .play {
    position: absolute;
    right: 0.625rem;
    bottom: 0.625rem;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.75rem;
    height: 2.75rem;
    border: none;
    border-radius: 9999px;
    background: rgb(255 255 255 / 0.28);
    backdrop-filter: blur(4px);
    color: white;
    font-size: 1.375rem;
    cursor: pointer;
    transition: background 200ms, transform 75ms;
  }

  .play:hover {
    background: rgb(255 255 255 / 0.45);
  }

  .play:active {
    transform: scale(0.9);
  }

  .word {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.875rem;
  }

  .lexeme {
    font-size: 1.5rem;
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  .phonetic {
    color: var(--color-secondary);
    font-size: 0.9375rem;
  }

  .speaker {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin-top: 0.25rem;
    font-size: 0.8125rem;
    color: var(--color-secondary);
  }

  .glosses {
    margin: 0.625rem 0 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .gloss-row {
    display: flex;
    gap: 0.5rem;
    font-size: 0.9375rem;
  }

  dt {
    color: var(--color-secondary);
    font-size: 0.8125rem;
    min-width: 5.5rem;
    padding-top: 0.0625rem;
  }

  dd {
    margin: 0;
  }

  .example {
    margin: 0.75rem 0 0;
    padding: 0.5rem 0.875rem;
    border-inline-start: 3px solid color-mix(in srgb, var(--primary) 45%, transparent);
    background: color-mix(in srgb, var(--primary) 5%, transparent);
    border-radius: 0.375rem;
  }

  .example-text {
    font-size: 0.9375rem;
  }

  .example-translation {
    font-size: 0.8125rem;
    color: var(--color-secondary);
    margin-top: 0.125rem;
  }

  .footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .dict-link {
    display: flex;
    flex-direction: column;
    min-width: 0;
    text-decoration: none;
    color: inherit;
  }

  .dict-link:hover .dict-name {
    color: var(--primary);
    text-decoration: underline;
  }

  .dict-name {
    font-weight: 600;
    font-size: 0.9375rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dict-location {
    font-size: 0.75rem;
    color: var(--color-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
