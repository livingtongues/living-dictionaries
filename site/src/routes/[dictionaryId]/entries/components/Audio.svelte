<script module lang="ts">
  import { writable } from 'svelte/store'

  interface AudioState {
    current_audio: HTMLAudioElement | null
    is_playing: boolean
  }

  const audioStore = writable<AudioState>({
    current_audio: null,
    is_playing: false,
  })

  function playAudio(url: string) {
    audioStore.update((store) => {
      if (store.current_audio) {
        store.current_audio.pause()
        store.current_audio = null
      }

      const audio = new Audio(url)
      audio.play()

      audio.addEventListener('ended', () => {
        audioStore.set({ current_audio: null, is_playing: false })
      })

      return { current_audio: audio, is_playing: true }
    })
  }
</script>

<script lang="ts">
  import type { EntryData } from '$lib/types'
  import { longpress, ShowHide } from '$lib/svelte-pieces'
  import { page } from '$app/state'
  import { minutes_ago_in_ms } from '$lib/helpers/time'
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
    playAudio(url_from_storage_path(sound_file.storage_path))
  }

  const playing = $derived($audioStore.is_playing && $audioStore.current_audio?.src === url_from_storage_path(sound_file?.storage_path))
</script>

<ShowHide>
  {#snippet children({ show, toggle })}
    {#if sound_file}
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
        {#if context === 'list'}
          <IconMaterialSymbolsHearing class="icon-inline {playing ? 'playing-color' : ''}" style="font-size: 1.25rem; margin-top: 0.25rem" />
          <div class="listen-label">
            {page.data.t('audio.listen')}
          </div>
        {:else if context === 'table'}
          <IconMaterialSymbolsHearing class="icon-inline {playing ? 'playing-color' : ''}" style="font-size: 1.125rem; margin-top: 0.25rem" />
        {:else if context === 'entry'}
          <IconMaterialSymbolsHearing class="icon-inline {playing ? 'playing-color' : ''}" style="font-size: 1.125rem; margin-bottom: 0.25rem" />
          <div class="entry-label">
            {page.data.t('audio.listen')}
            {#if can_edit}
              +
              {page.data.t('audio.edit_audio')}
            {/if}
          </div>
        {/if}
      </div>
    {:else if can_edit}
      <div
        class="{klass} audio-action add-audio"
        onclick={toggle}>
        <IconUilMicrophone class="icon-inline {context === 'list' || context === 'table' ? 'mic-color' : ''}" style="font-size: 1.125rem; margin: 0.25rem" />
        {#if context === 'entry'}
          <div style="font-size: 0.75rem; line-height: 1rem">
            {page.data.t('audio.add_audio')}
          </div>
        {/if}
      </div>
    {/if}

    {#if show}
      {#await import('$lib/components/audio/EditAudio.svelte') then { default: EditAudio }}
        <EditAudio {entry} {sound_file} on_close={toggle} />
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

  .listen-label {
    font-size: 0.75rem;
    line-height: 1rem;
    text-align: center;
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 1;
    width: 100%;
    overflow-wrap: break-word;
  }

  .entry-label {
    text-align: center;
    font-size: 0.75rem;
    line-height: 1rem;
  }
</style>
