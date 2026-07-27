<script module lang="ts">
  import { writable } from 'svelte/store'
  import { play_audio_element } from '$lib/media/play-audio-element'
  import { toast } from '$lib/state/toast.svelte'

  interface AudioState {
    current_audio: HTMLAudioElement | null
    is_playing: boolean
  }

  const audioStore = writable<AudioState>({
    current_audio: null,
    is_playing: false,
  })

  /** Failure handling (telemetry + not lying about the playing state) lives in `play_audio_element`. */
  function play_audio({ url, context }: {
    url: string
    context: { dictionary_id: string, entry_id: string, audio_id?: string, storage_path?: string, failure_message: string }
  }) {
    audioStore.update((store) => {
      if (store.current_audio) {
        store.current_audio.pause()
        store.current_audio = null
      }

      const audio = new Audio(url)
      play_audio_element({
        audio,
        context: {
          surface: 'entry_audio',
          dictionary_id: context.dictionary_id,
          entry_id: context.entry_id,
          audio_id: context.audio_id ?? null,
          storage_path: context.storage_path ?? null,
        },
        on_failure: () => {
          // Say something. A silent failed tap is why these visitors tapped five times.
          toast.error(context.failure_message)
          audioStore.set({ current_audio: null, is_playing: false })
        },
      })

      audio.addEventListener('ended', () => {
        audioStore.set({ current_audio: null, is_playing: false })
      })

      return { current_audio: audio, is_playing: true }
    })
  }
</script>

<script lang="ts">
  import type { EntryData } from '$lib/types'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import { longpress } from '$lib/utils/longpress'
  import { page } from '$app/state'
  import { minutes_ago_in_ms } from '$lib/utils/time'
  import { track } from '$lib/debug/remote-log'
  import { AUDIO_PLAYED } from '$lib/debug/log-events'
  import IconMaterialSymbolsHearing from '~icons/material-symbols/hearing'
  import IconUilMicrophone from '~icons/uil/microphone'

  interface Props {
    entry: EntryData
    context: 'list' | 'table' | 'entry'
    sound_file?: EntryData['audios'][0]
    can_edit?: boolean
    class?: string
  }

  const { entry, context, sound_file = undefined, can_edit = false, class: klass = '' }: Props = $props()

  const url_from_storage_path = $derived(page.data.url_from_storage_path)

  function initAudio() {
    track({ event: AUDIO_PLAYED, props: { dictionary_id: page.params.dictionaryId, entry_id: entry.id, audio_id: sound_file?.id, context } })
    play_audio({
      url: url_from_storage_path(sound_file.storage_path),
      context: {
        dictionary_id: page.params.dictionaryId,
        entry_id: entry.id,
        audio_id: sound_file?.id,
        storage_path: sound_file?.storage_path,
        failure_message: page.data.t('audio.playback_failed'),
      },
    })
  }

  const playing = $derived($audioStore.is_playing && $audioStore.current_audio?.src === url_from_storage_path(sound_file?.storage_path))
</script>

<ShowHide>
  {#snippet children({ show, toggle })}
    {#if sound_file && context === 'list'}
      <!-- Listen-only for EVERYONE (editors edit via the row's ⋯ menu) — no hidden long-press edit. -->
      <button
        type="button"
        class="{klass} list-play-button"
        class:playing
        title={page.data.t('audio.listen')}
        onclick={() => initAudio()}>
        <IconMaterialSymbolsHearing style="font-size: 1.125rem" />
      </button>
    {:else if sound_file}
      {@const updated_within_last_5_minutes = sound_file.updated_at && can_edit && new Date(sound_file.updated_at).getTime() > minutes_ago_in_ms(5)}
      <div
        class:recently-updated={updated_within_last_5_minutes}
        class="{klass} audio-action has-audio"
        title={page.data.t('audio.listen')}
        use:longpress={800}
        onlongpress={() => initAudio()}
        onclick={() => {
          if (can_edit)
            toggle()
          else
            initAudio()
        }}>
        {#if context === 'table'}
          <IconMaterialSymbolsHearing class="{playing ? 'playing-color' : ''}" style="font-size: 1.125rem; margin-top: 0.25rem" />
        {:else if context === 'entry'}
          <IconMaterialSymbolsHearing class="{playing ? 'playing-color' : ''}" style="font-size: 1.125rem; margin-bottom: 0.25rem" />
          <div class="entry-label">
            {page.data.t('audio.listen')}
            {#if can_edit}
              +
              {page.data.t('audio.edit_audio')}
            {/if}
          </div>
        {/if}
      </div>
    {:else if can_edit && context !== 'list'}
      <div
        class="{klass} audio-action add-audio"
        onclick={toggle}>
        <IconUilMicrophone class="{context === 'table' ? 'mic-color' : ''}" style="font-size: 1.125rem; margin: 0.25rem" />
        {#if context === 'entry'}
          <div style="font-size: 0.75rem; line-height: 1rem">
            {page.data.t('audio.add_audio')}
          </div>
        {/if}
      </div>
    {/if}

    {#if show}
      {#await import('$lib/components/audio/EditAudio.svelte') then { default: EditAudio }}
        <EditAudio {entry} {sound_file} {context} on_close={toggle} />
      {/await}
    {/if}
  {/snippet}
</ShowHide>

<style>
  .audio-action {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    user-select: none;
  }

  .has-audio {
    border-color: rgb(134 239 172); /* green-300 */
  }

  .has-audio:hover {
    background-color: color-mix(in srgb, var(--background), var(--color) 10%); /* ≈ gray-200 */
  }

  .recently-updated {
    border-bottom-width: 2px;
  }

  .add-audio:hover {
    background-color: color-mix(in srgb, var(--background), var(--color) 18%); /* ≈ gray-300 */
  }

  .audio-action :global(.playing-color) {
    color: rgb(29 78 216); /* blue-700 */
  }

  .audio-action :global(.mic-color) {
    color: rgb(30 64 175); /* blue-800 */
  }

  .list-play-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 1.75rem;
    height: 1.75rem;
    border: none;
    border-radius: 50%;
    background: color-mix(in srgb, var(--primary) 12%, transparent);
    color: var(--primary);
    cursor: pointer;
    transition: background var(--transition-time, 150ms), transform 75ms;
  }

  .list-play-button:hover {
    background: color-mix(in srgb, var(--primary) 22%, transparent);
  }

  .list-play-button:active {
    transform: scale(0.93);
  }

  .list-play-button.playing {
    background: var(--primary);
    color: var(--on-primary);
  }

  .entry-label {
    text-align: center;
    font-size: 0.75rem;
    line-height: 1rem;
  }
</style>
