<script lang="ts">
  import type { EntryData } from '$lib/types'
  import { page } from '$app/state'
  import Popover from '$lib/components/ui/Popover.svelte'
  import { get_headword } from '$lib/orthography/orthographies'
  import { audio_element_from_storage_path } from '$lib/utils/media-url'
  import { play_audio_element } from '$lib/media/play-audio-element'
  import IconMdiArrowRight from '~icons/mdi/arrow-right'
  import IconMdiVolumeHigh from '~icons/mdi/volume-high'

  /**
   * The card a reader gets when tapping a linked word in authored prose.
   * Hearing the word WITHOUT leaving the grammar is the point — a learner
   * reading a paradigm can play each form in place, so audio comes before the
   * jump to the full entry.
   */

  interface Props {
    entry_ids: string[]
    /** The word as written in the prose — shown when the entry is still loading. */
    form: string
    anchor: HTMLElement
    on_close: () => void
  }

  const { entry_ids, form, anchor, on_close }: Props = $props()

  const { t, dictionary, entries_data } = $derived(page.data)

  const entries = $derived(entry_ids
    .map(id => [id, $entries_data[id] as EntryData | undefined] as const)
    .filter(([, entry]) => !!entry))

  let playing_id = $state<string | null>(null)
  let audio_element: HTMLAudioElement | undefined

  function headword(entry: EntryData | undefined): string {
    if (!entry) return ''
    return get_headword({ lexeme: entry.main.lexeme, orthographies: dictionary.orthographies }).value
  }

  function glosses(entry: EntryData | undefined): string {
    const sense = entry?.senses?.[0]
    if (!sense) return ''
    return Object.values(sense.glosses ?? {}).filter(Boolean).join(', ')
  }

  function parts_of_speech(entry: EntryData | undefined): string {
    return (entry?.senses?.[0]?.parts_of_speech ?? [])
      .map(abbreviation => t({ dynamicKey: `psAbbrev.${abbreviation}`, fallback: abbreviation }))
      .join(', ')
  }

  function audio_path(entry: EntryData | undefined): string | null {
    return entry?.audios?.find(audio => audio.storage_path)?.storage_path ?? null
  }

  // With homographs, one entry may have audio and another not — keep the play
  // column reserved for all of them so the headwords still line up.
  const any_audio = $derived(entries.some(([, entry]) => audio_path(entry)))

  function play(entry_id: string, storage_path: string) {
    audio_element?.pause()
    audio_element = audio_element_from_storage_path(storage_path)
    const finish = () => { if (playing_id === entry_id) playing_id = null }
    audio_element.onended = finish
    audio_element.onerror = finish
    playing_id = entry_id
    play_audio_element({
      audio: audio_element,
      context: { surface: 'entry_mention_popover', dictionary_id: dictionary.id, entry_id, storage_path },
      on_failure: finish,
    })
  }

  $effect(() => () => audio_element?.pause())
</script>

<Popover {anchor} {on_close} max_width="18rem">
  {#if !entries.length}
    <div class="empty">{form}</div>
  {:else}
    {#if entries.length > 1}
      <div class="multi-label">{t('grammar.multiple_entries')}</div>
    {/if}
    <div class="list">
      {#each entries as [entry_id, entry] (entry_id)}
        {@const storage_path = audio_path(entry)}
        <div class="row">
          {#if storage_path}
            <button
              type="button"
              class="play"
              class:playing={playing_id === entry_id}
              aria-label={t('misc.play')}
              onclick={() => play(entry_id, storage_path)}>
              <IconMdiVolumeHigh />
            </button>
          {:else if any_audio}
            <span class="play-placeholder"></span>
          {/if}
          <div class="text">
            <span class="headword">{headword(entry) || form}</span>
            {#if parts_of_speech(entry)}<span class="pos">{parts_of_speech(entry)}</span>{/if}
            {#if glosses(entry)}<span class="gloss">{glosses(entry)}</span>{/if}
          </div>
          <a class="view" href={`/${dictionary.url}/entry/${entry_id}`} title={t('token.view_entry')}>
            <IconMdiArrowRight />
          </a>
        </div>
      {/each}
    </div>
  {/if}
</Popover>

<style>
  .empty {
    color: var(--color-secondary);
    font-size: 0.875rem;
  }

  .multi-label {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--color-secondary);
    margin-bottom: 0.375rem;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0;
  }

  .row + .row {
    border-top: 1px solid var(--border-color);
  }

  .play {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 2rem;
    height: 2rem;
    border-radius: 999px;
    border: 0;
    background: color-mix(in srgb, var(--primary) 12%, var(--background));
    color: var(--primary);
    cursor: pointer;
  }

  .play:hover,
  .play.playing {
    background: var(--primary);
    color: white;
  }

  .play-placeholder {
    flex-shrink: 0;
    width: 2rem;
  }

  .text {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }

  .headword {
    font-weight: 600;
    line-height: 1.25;
  }

  .pos {
    font-size: 0.6875rem;
    font-style: italic;
    color: var(--color-secondary);
  }

  .gloss {
    font-size: 0.8125rem;
    color: var(--color-secondary);
    line-height: 1.3;
  }

  .view {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 0.375rem;
    color: var(--color-secondary);
  }

  .view:hover {
    background: var(--surface);
    color: var(--primary);
  }
</style>
