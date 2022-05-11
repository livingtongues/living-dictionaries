<script lang="ts">
  import type { IEntry } from '@living-dictionaries/types';
  export let entry: IEntry,
    canEdit = false;
</script>

<div
  class:cursor-pointer={canEdit}
  class="h-full"
  style="padding: 0.1em 0.25em"
  on:click={() => {
    if (canEdit) {
      if (entry.sf && entry.sf.sp) {
        alert(
          'Please edit the speaker by from the edit audio modal accessed by clicking on the ear.'
        );
      } else {
        alert('Edit speaker feature is still in progress');
      }
    }
  }}>
  {#if entry.sf}{entry.sf.sp || entry.sf.speakerName || ''}{/if}
  &nbsp;
</div>
<!-- sf.speakerName is a write-in name from old Talking Dictionary imports -->
