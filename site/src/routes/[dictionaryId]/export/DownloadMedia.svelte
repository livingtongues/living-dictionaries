<script lang="ts">
  import JSZip from 'jszip'
  import type { Tables } from '$lib/types'
  import { onDestroy, onMount } from 'svelte'
  import type { EntryForCSV } from './prepare-entries-for-csv'
  import { objectsToCsvByHeaders } from '$lib/export/csv'
  import { downloadBlob } from '$lib/export/download-blob'

  interface Props {
    dictionary: Tables<'dictionaries'>
    entryHeaders: EntryForCSV
    finalizedEntries: EntryForCSV[]
    entriesWithImages?: EntryForCSV[]
    entriesWithAudio?: EntryForCSV[]
    on_completed?: () => void
    children?: import('svelte').Snippet<[any]>
  }

  const {
    dictionary,
    entryHeaders,
    finalizedEntries,
    entriesWithImages = [],
    entriesWithAudio = [],
    on_completed,
    children,
  }: Props = $props()

  let fetched = $state(0)
  const progress = $derived(fetched / (entriesWithImages.length + entriesWithAudio.length))
  let errors = $state([])
  let destroyed = false

  onMount(async () => {
    const zip = new JSZip()

    for (const entry of entriesWithImages) {
      if (destroyed) return
      // @ts-ignore
      const image_file_path = entry.photoSource
      try {
        const response = await fetch(image_file_path)
        if (response.ok) {
          const blob = await response.blob()
          // @ts-ignore
          zip.folder(`${dictionary.url}_Images/`).file(entry?.photoFile, blob, { binary: true })
        } else {
          errors = [
            ...errors,
            `Entry: ${entry.lexeme}, Id: ${entry.ID}, File: ${image_file_path}, Error: ${response.statusText}`,
          ]
        }
      } catch (e) {
        errors = [...errors, `Entry: ${entry.ID}, File: ${image_file_path}, ${e}`]
      }
      fetched++
    }

    for (const entry of entriesWithAudio) {
      if (destroyed) return
      const sound_file_path = entry.soundSource
      try {
        const response = await fetch(sound_file_path)
        if (response.ok) {
          const blob = await response.blob()
          zip.folder(`${dictionary.url}_Audio/`).file(entry.soundFile, blob, { binary: true })
        } else {
          errors = [
            ...errors,
            `Entry: ${entry.lexeme}, Id: ${entry.ID}, File: ${sound_file_path}, Error: ${response.status} ${response.statusText}`,
          ]
        }
      } catch (e) {
        errors = [...errors, `Entry: ${entry.ID}, File: ${sound_file_path}, ${e}`]
      }
      fetched++
    }

    const csv = objectsToCsvByHeaders(entryHeaders, finalizedEntries)
    const csvBlob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })

    zip.file(`${dictionary.url}.csv`, csvBlob)

    const blob = await zip.generateAsync({ type: 'blob' })
    if (destroyed) return
    downloadBlob(blob, dictionary.url, '.zip')
    if (!errors.length)
      on_completed?.()
  })

  onDestroy(() => {
    destroyed = true
  })
</script>

<div>
  {@render children?.({ progress })}
</div>

{#if errors.length}
  <div class="errors-block">
    <div style="font-weight: 600">Errors:</div>
    {#each errors as error (error)}
      <div style="margin-bottom: 0.75rem">{error}</div>
    {/each}
  </div>
{/if}

<style>
  .errors-block {
    margin-top: 1rem;
    color: var(--danger);
    font-size: 0.875rem;
    line-height: 1.25rem;
  }
</style>
