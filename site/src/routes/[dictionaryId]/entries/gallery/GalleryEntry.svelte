<script lang="ts">
  import type { EntryData, Tables } from '$lib/types'
  import Image from '$lib/components/image/Image.svelte'
  import { PUBLIC_STORAGE_BUCKET } from '$env/static/public'
  import { url_from_storage_path } from '$lib/utils/media-url'
  import { create_exclusive_audio } from '$lib/utils/exclusive-audio.svelte'
  import { get_headword } from '$lib/helpers/orthographies'
  import { get_local_orthographies } from '$lib/helpers/entry/get_local_orthagraphies'
  import { add_periods_and_comma_separate_parts_of_speech } from '$lib/helpers/entry/add_periods_and_comma_separate_parts_of_speech'
  import { top_glosses } from '../../home/home-helpers'
  import IconMaterialSymbolsHearing from '~icons/material-symbols/hearing'
  import { page } from '$app/state'

  interface Props {
    entry: EntryData
    can_edit?: boolean
    dictionary: Tables<'dictionaries'>
  }

  const { entry, can_edit = false, dictionary }: Props = $props()

  const { db_operations, t } = $derived(page.data)

  const first_photo = $derived(entry.senses?.flatMap(sense => sense.photos || [])[0])
  const headword = $derived(get_headword({ lexeme: entry.main.lexeme, orthographies: dictionary.orthographies }))
  const alt = $derived(get_local_orthographies(entry.main.lexeme, { exclude_code: headword.code })[0] ?? null)
  const phonetic = $derived(entry.main.phonetic ?? null)
  const pos = $derived.by(() => {
    const parts_of_speech = entry.senses?.[0]?.parts_of_speech
    if (!parts_of_speech?.length)
      return null
    return add_periods_and_comma_separate_parts_of_speech(
      parts_of_speech.map(part => t({ dynamicKey: `psAbbrev.${part}`, fallback: part })),
    ) || null
  })
  const glosses = $derived.by(() => {
    const first_glosses = entry.senses?.map(sense => sense.glosses).find(g => g && Object.values(g).some(Boolean))
    return top_glosses({ glosses: first_glosses, gloss_languages: dictionary.gloss_languages })
  })
  const dialect = $derived(entry.dialects?.[0]?.name?.default ?? null)
  const audio_storage_path = $derived(entry.audios?.[0]?.storage_path ?? null)

  const audio = create_exclusive_audio()
</script>

{#if first_photo}
  <div class="card">
    <Image
      square={480}
      title={headword.value}
      subtitle={glosses[0]}
      href="/{dictionary.url}/entry/{entry.id}"
      gcs={first_photo.serving_url}
      photo_source={first_photo.source}
      photographer={first_photo.photographer}
      page_context="gallery"
      {can_edit}
      on_delete_image={async () => await db_operations.delete_photo(first_photo.id)} />
    <div class="scrim"></div>
    <div class="content">
      {#if dialect}
        <span class="dialect">{dialect}</span>
      {/if}
      <div class="lexeme">{headword.value}</div>
      {#if alt}
        <div class="alt">{alt}</div>
      {/if}
      {#if phonetic}
        <div class="phonetic">[{phonetic}]</div>
      {/if}
      <div class="spacer"></div>
      <div class="bottom" class:room-for-ear={!!audio_storage_path}>
        {#if pos}
          <div class="pos">{pos}</div>
        {/if}
        {#each glosses as gloss, index (index)}
          <div class="gloss" class:secondary={index > 0}>{gloss}</div>
        {/each}
      </div>
    </div>
    {#if audio_storage_path}
      <button
        type="button"
        class="overlay-button play"
        class:playing={audio.playing}
        onclick={() => audio.toggle(url_from_storage_path(audio_storage_path, PUBLIC_STORAGE_BUCKET))}
        aria-label="{audio.playing ? t('misc.pause') : t('misc.play')} {headword.value}">
        <IconMaterialSymbolsHearing />
      </button>
    {/if}
  </div>
{/if}

<style>
  /* Same visual language as the dictionary-home featured cards (home/HomeEntryCard.svelte),
     sized by the gallery grid; clicking the photo opens the fullscreen viewer. */
  .card {
    position: relative;
    aspect-ratio: 1 / 1;
    max-width: 500px;
    border-radius: 0.875rem;
    overflow: hidden;
    transition: transform 200ms;
  }

  /* Lift only while the viewer is closed — a transformed ancestor would become the
     containing block for the fullscreen viewer (position: fixed) and clip it to the card. */
  .card:hover:has(:global(.image-wrap:not(.viewing))) {
    transform: translateY(-3px);
  }

  /* Full-card scrim so the top text block reads over any photo, heavier at the base. */
  .scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, rgb(0 0 0 / 0.42), rgb(0 0 0 / 0.14) 40%, rgb(0 0 0 / 0.3) 62%, rgb(0 0 0 / 0.78));
    pointer-events: none; /* the photo underneath owns the click (fullscreen viewer) */
  }

  .content {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 0.625rem 0.625rem 0.5rem;
    color: white;
    text-shadow: 0 1px 2px rgb(0 0 0 / 0.55);
    pointer-events: none;
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
    transition: background 200ms, transform 75ms;
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
</style>
