<script lang="ts">
  import type { EntryView } from '@living-dictionaries/types'
  import { ShowHide } from 'svelte-pieces'
  import { page } from '$app/stores'

  export let entry: EntryView
  export let can_edit = false

  $: ({ speakers } = $page.data)

  $: first_audio = entry?.audios?.[0]
  $: speaker_name = ($speakers?.length && first_audio?.speaker_ids?.length) ? $speakers.find(speaker => speaker.id === first_audio.speaker_ids[0])?.name : ''
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
