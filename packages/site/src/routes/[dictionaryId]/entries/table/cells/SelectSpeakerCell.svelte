<script lang="ts">
  import { ShowHide } from 'svelte-pieces'
  import type { EntryData } from '$lib/search/types'

  export let entry: EntryData
  export let can_edit = false

  $: first_audio = entry?.audios?.[0]
  $: speaker_name = first_audio?.speakers?.[0].name || ''
</script>

<ShowHide let:show let:set let:toggle>
  <div
    class:cursor-pointer={can_edit}
    class="h-full"
    style="padding: 0.1em 0.25em"
    on:click={() => set(can_edit)}>
    {speaker_name}
    &nbsp;
  </div>

  {#if show}
    {#await import('$lib/components/audio/EditAudio.svelte') then { default: EditAudio }}
      <EditAudio {entry} sound_file={first_audio} on_close={toggle} />
    {/await}
  {/if}
</ShowHide>
