<script lang="ts">
  import type { EntryData } from '$lib/types'
  import { ShowHide } from '$lib/svelte-pieces'
  import { page } from '$app/state'

  interface Props {
    entry: EntryData
    can_edit?: boolean
  }

  const { entry, can_edit = false }: Props = $props()

  const { sources } = $derived(page.data)

  const first_audio = $derived(entry?.audios?.[0])
  const speaker_name = $derived(first_audio?.speakers?.[0].name || '')
  // Speaker-less audio attributed to a sources-registry entry — show the source label, dimmed/italic.
  const source_label = $derived.by(() => {
    if (speaker_name || !first_audio?.source) return ''
    const source = ($sources || []).find(candidate => candidate.slug === first_audio.source)
    return source?.abbreviation || source?.citation || first_audio.source
  })
</script>

<ShowHide>
  {#snippet children({ show, set, toggle })}
    <div
      class:editable={can_edit}
      class="speaker-cell"
      style="padding: 0.1em 0.25em"
      onclick={() => set(can_edit)}>
      {#if speaker_name}
        {speaker_name}
      {:else if source_label}
        <span class="source-label">{source_label}</span>
      {/if}
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

  .source-label {
    font-style: italic;
    opacity: 0.6;
  }
</style>
