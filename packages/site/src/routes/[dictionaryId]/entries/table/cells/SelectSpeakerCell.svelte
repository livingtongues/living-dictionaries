<script lang="ts">
  import type { ExpandedEntry, ISpeaker } from '@living-dictionaries/types'

  export let entry: ExpandedEntry
  export let can_edit = false
  export let speakers: ISpeaker[]
  let displayed_speaker_name: string

  $: first_sound_file = entry?.sound_files?.[0]
  $: if (first_sound_file?.speaker_ids?.length) {
    displayed_speaker_name = speakers.find(speaker => speaker.uid === first_sound_file.speaker_ids[0])?.displayName
    if (!displayed_speaker_name) {
      console.error(`Missing speaker ID: ${first_sound_file.speaker_ids[0]}`)
    }
  } else {
    displayed_speaker_name = first_sound_file?.speakerName
  }
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
  {displayed_speaker_name || ''}
  &nbsp;
</div>
