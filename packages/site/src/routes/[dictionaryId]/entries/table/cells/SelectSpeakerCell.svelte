<script lang="ts">
  import { ShowHide } from '$lib/svelte-pieces'
  import type { EntryData } from '@living-dictionaries/types'

  interface Props {
    entry: EntryData;
    can_edit?: boolean;
  }

  let { entry, can_edit = false }: Props = $props();

  let first_audio = $derived(entry?.audios?.[0])
  let speaker_name = $derived(first_audio?.speakers?.[0].name || '')
</script>

<ShowHide   >
  {#snippet children({ show, set, toggle })}
    <div
      class:cursor-pointer={can_edit}
      class="h-full"
      style="padding: 0.1em 0.25em"
      onclick={() => set(can_edit)}>
      {speaker_name}
      &nbsp;
    </div>

    {#if show}
      {#await import('$lib/components/audio/EditAudio.svelte') then { default: EditAudio }}
        <EditAudio {entry} sound_file={first_audio} on_close={toggle} />
      {/await}
    {/if}
  {/snippet}
</ShowHide>
