<script lang="ts">
  import type { ExpandedEntry, ISpeaker } from '@living-dictionaries/types'

  export let entry: ExpandedEntry
  export let can_edit = false
  export let speakers: ISpeaker[]

  $: first_sound_file = entry.sound_files?.[0]
</script>

<div
  class:cursor-pointer={can_edit}
  class="h-full"
  style="padding: 0.1em 0.25em"
  on:click={() => {
    if (can_edit) {
      if (first_sound_file?.speaker_ids?.length) {
        alert(
          'Please edit the speaker by from the edit audio modal accessed by clicking on the ear.',
        )
      } else {
        alert('Edit speaker feature is still in progress')
      }
    }
  }}>
  {#if first_sound_file}
    {#if first_sound_file.speaker_ids?.length}
      {speakers.find(speaker => speaker.uid === first_sound_file.speaker_ids[0]).displayName}
    {:else}
      {first_sound_file.speakerName || ''}
    {/if}
  {/if}
  &nbsp;
</div>
