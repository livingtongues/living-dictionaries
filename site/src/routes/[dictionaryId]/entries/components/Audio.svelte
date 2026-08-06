<script lang="ts">
  import type { EntryData } from '$lib/types'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import { longpress } from '$lib/utils/longpress'
  import { page } from '$app/state'
  import { minutes_ago_in_ms } from '$lib/utils/time'
  import { track } from '$lib/debug/remote-log'
  import { AUDIO_PLAYED } from '$lib/debug/log-events'
  import { entry_audio } from '$lib/entry/entry-audio/entry-audio-state.svelte'
  import type { AudioOption } from '$lib/entry/entry-audio/audio-option-labels'
  import IconMaterialSymbolsHearing from '~icons/material-symbols/hearing'
  import IconUilMicrophone from '~icons/uil/microphone'

  // Entry-detail audio TILE (+ the add-audio affordance for table/entry).
  // Compact playback on list/table/gallery/home is `$lib/entry/entry-audio/EntryAudioControl.svelte`;
  // playback here goes through the same exclusive `entry_audio` state.

  interface Props {
    entry: EntryData
    context: 'table' | 'entry'
    sound_file?: EntryData['audios'][0]
    /** Chooser-consistent label (name / duplicate ordinal / bare position) computed across the entry's audios. */
    speaker_label?: AudioOption | null
    can_edit?: boolean
    class?: string
  }

  const { entry, context, sound_file = undefined, speaker_label = null, can_edit = false, class: klass = '' }: Props = $props()

  const label = $derived.by((): Pick<AudioOption, 'label' | 'ordinal' | 'no_speaker'> | null => {
    if (speaker_label) return speaker_label
    const name = sound_file?.speakers?.[0]?.name
    return name ? { label: name, ordinal: null, no_speaker: false } : null
  })

  function initAudio() {
    const dictionary_id = page.params.dictionaryId
    track({ event: AUDIO_PLAYED, props: { dictionary_id, entry_id: entry.id, audio_id: sound_file?.id, context } })
    entry_audio.toggle({
      audio_id: sound_file.id,
      storage_path: sound_file.storage_path,
      context: { dictionary_id, entry_id: entry.id, context },
      failure_message: page.data.t('audio.playback_failed'),
    })
  }

  const playing = $derived(entry_audio.is_active(sound_file?.id))
</script>

<ShowHide>
  {#snippet children({ show, toggle })}
    {#if sound_file && context === 'entry'}
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
        <IconMaterialSymbolsHearing class="{playing ? 'playing-color' : ''}" style="font-size: 1.125rem; margin-bottom: 0.25rem" />
        {#if label}
          <div class="speaker-name" class:no-speaker={label.no_speaker}>
            {label.label}{#if label.ordinal}<span class="ordinal">{label.ordinal}</span>{/if}
          </div>
        {/if}
        <div class="entry-label">
          {page.data.t('audio.listen')}
          {#if can_edit}
            +
            {page.data.t('audio.edit_audio')}
          {/if}
        </div>
      </div>
    {:else if !sound_file && can_edit}
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

  .speaker-name {
    max-width: 100%;
    padding: 0 0.375rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: center;
    font-size: 0.8125rem;
    font-weight: 600;
    line-height: 1.125rem;
  }

  .speaker-name.no-speaker {
    font-style: italic;
    font-weight: 400;
    opacity: 0.7;
  }

  .ordinal {
    margin-inline-start: 0.25rem;
    font-size: 0.6875rem;
    font-weight: 400;
    opacity: 0.55;
  }

  .entry-label {
    text-align: center;
    font-size: 0.75rem;
    line-height: 1rem;
    color: var(--color-secondary);
  }
</style>
