<script lang="ts">
  import type { ExpandedEntry } from '@living-dictionaries/types';
  export let entry: ExpandedEntry;
  export let canEdit = false;

  $: first_sound_file = entry.sound_files?.[0];
</script>

<div
  class:cursor-pointer={canEdit}
  class="h-full"
  style="padding: 0.1em 0.25em"
  on:click={() => {
    if (canEdit) {
      if (first_sound_file?.speaker_ids?.length) {
        alert(
          'Please edit the speaker by from the edit audio modal accessed by clicking on the ear.'
        );
      } else {
        alert('Edit speaker feature is still in progress');
      }
    }
  }}>
  {#if first_sound_file}
    {#if first_sound_file.speaker_ids?.length}
      {first_sound_file.speaker_ids[0]}
    {:else}
      {first_sound_file.speakerName || ''}
    {/if}
  {/if}
  &nbsp;
</div>
