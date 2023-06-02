<script lang="ts">
  import JSZip from 'jszip';
  import { downloadBlob } from '$lib/export/downloadBlob';
  import type { IDictionary } from '@living-dictionaries/types';
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import { getStorageDownloadUrl } from './storageUrl';
  import type { EntryForCSV } from './prepareEntriesForCsv';
  import { objectsToCsvByHeaders } from '$lib/export/csv';

  export let dictionary: IDictionary;
  export let finalizedEntries: EntryForCSV[];
  export let entriesWithImages: EntryForCSV[] = [];
  export let entriesWithAudio: EntryForCSV[] = [];

  const dispatch = createEventDispatcher<{ completed: null }>();

  let fetched = 0;
  $: progress = fetched / (entriesWithImages.length + entriesWithAudio.length);
  let errors = [];
  let destroyed = false;

  onMount(async () => {
    const zip = new JSZip();

    for (const entry of entriesWithImages) {
      if (destroyed) return;
      try {
        const response = await fetch(getStorageDownloadUrl(entry.image_file_path));
        if (response.ok) {
          const blob = await response.blob();
          zip.folder(`${dictionary.id}_Images/`).file(entry.image_filename, blob, { binary: true });
        } else {
          errors = [
            ...errors,
            `Entry: ${entry.lexeme}, Id: ${entry.id}, File: ${entry.image_file_path}, Error: ${response.statusText}`,
          ];
        }
      } catch (e) {
        errors = [...errors, `Entry: ${entry.id}, File: ${entry.image_file_path}, ${e}`];
      }
      fetched++;
    }
    for (const entry of entriesWithAudio) {
      if (destroyed) return;
      try {
        const response = await fetch(getStorageDownloadUrl(entry.sound_file_path));
        if (response.ok) {
          const blob = await response.blob();
          zip.folder(`${dictionary.id}_Audio/`).file(entry.sound_filename, blob, { binary: true });
        } else {
          errors = [
            ...errors,
            `Entry: ${entry.lexeme}, Id: ${entry.id}, File: ${entry.sound_file_path}, Error: ${response.status} ${response.statusText}`,
          ];
        }
      } catch (e) {
        errors = [...errors, `Entry: ${entry.id}, File: ${entry.sound_file_path}, ${e}`];
      }
      fetched++;
    }

    const headers = finalizedEntries[0]
    const entries = finalizedEntries.slice(1) // takes all but first
    const csv = objectsToCsvByHeaders(headers, entries);
    const csvBlob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

    zip.file(`${dictionary.id}.csv`, csvBlob);

    const blob = await zip.generateAsync({ type: 'blob' });
    if (destroyed) return;
    downloadBlob(blob, dictionary.id, '.zip');
    if (!errors.length) {
      dispatch('completed');
    }
  });

  onDestroy(() => {
    destroyed = true;
  });
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
