<script lang="ts">
  import type { EntryData } from '$lib/types'
  import { ShowHide } from '$lib/svelte-pieces'

  interface Props {
    entry: EntryData
    can_edit?: boolean
  }

  const { entry, can_edit = false }: Props = $props()

  const first_audio = $derived(entry?.audios?.[0])
  const speaker_name = $derived(first_audio?.speakers?.[0].name || '')
</script>

<ShowHide>
  {#snippet children({ show, set, toggle })}
    <div
      class:editable={can_edit}
      class="speaker-cell"
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

<style>
  .speaker-cell {
    height: 100%;
  }

  .editable {
    cursor: pointer;
  }
</style>
