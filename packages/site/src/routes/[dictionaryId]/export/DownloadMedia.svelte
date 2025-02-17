<script lang="ts">
  import JSZip from 'jszip'
  import type { Tables } from '@living-dictionaries/types'
  import { createEventDispatcher, onDestroy, onMount } from 'svelte'
  import type { EntryForCSV } from './prepareEntriesForCsv'
  import { objectsToCsvByHeaders } from '$lib/export/csv'
  import { downloadBlob } from '$lib/export/downloadBlob'

  export let dictionary: Tables<'dictionaries'>
  export let entryHeaders: EntryForCSV
  export let finalizedEntries: EntryForCSV[]
  export let entriesWithImages: EntryForCSV[] = []
  export let entriesWithAudio: EntryForCSV[] = []

  const dispatch = createEventDispatcher<{ completed: null }>()

  let fetched = 0
  $: progress = fetched / (entriesWithImages.length + entriesWithAudio.length)
  let errors = []
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
          zip.folder(`${dictionary.id}_Images/`).file(entry?.photoFile, blob, { binary: true })
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
          zip.folder(`${dictionary.id}_Audio/`).file(entry.soundFile, blob, { binary: true })
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
    const csvBlob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })

    zip.file(`${dictionary.id}.csv`, csvBlob)

    const blob = await zip.generateAsync({ type: 'blob' })
    if (destroyed) return
    downloadBlob(blob, dictionary.id, '.zip')
    if (!errors.length)
      dispatch('completed')
  })

  onDestroy(() => {
    destroyed = true
  })
</script>

<div>
  <slot {progress} />
</div>

{#if errors.length}
  <div class="mt-4 text-red-600 text-sm">
    <div class="font-semibold">Errors:</div>
    {#each errors as error}
      <div class="mb-3">{error}</div>
    {/each}
  </div>
{/if}
