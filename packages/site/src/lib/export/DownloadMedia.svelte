<script lang="ts">
  import JSZip from 'jszip';
  import { arrayToCSVBlob, downloadBlob } from './csv';
  import type { IDictionary } from '@living-dictionaries/types';
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import { getStorageDownloadUrl } from './storageUrl';
  import type { IEntryForCSV } from './formatEntries';

  export let dictionary: IDictionary;
  export let finalizedEntries: IEntryForCSV[];
  export let entriesWithImages: IEntryForCSV[] = [];
  export let entriesWithAudio: IEntryForCSV[] = [];

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
        const response = await fetch(getStorageDownloadUrl(entry.pfpa));
        if (response.ok) {
          const blob = await response.blob();
          zip.folder(`${dictionary.id}_Images/`).file(entry.pfFriendlyName, blob, { binary: true });
        } else {
          errors = [
            ...errors,
            `Entry: ${entry.lx}, Id: ${entry.id}, File: ${entry.pfpa}, Error: ${response.statusText}`,
          ];
        }
      } catch (e) {
        errors = [...errors, `Entry: ${entry.id}, File: ${entry.pfpa}, ${e}`];
      }
      fetched++;
    }
    for (const entry of entriesWithAudio) {
      if (destroyed) return;
      try {
        const response = await fetch(getStorageDownloadUrl(entry.sfpa));
        if (response.ok) {
          const blob = await response.blob();
          zip.folder(`${dictionary.id}_Audio/`).file(entry.sfFriendlyName, blob, { binary: true });
        } else {
          errors = [
            ...errors,
            `Entry: ${entry.lx}, Id: ${entry.id}, File: ${entry.sfpa}, Error: ${response.status} ${response.statusText}`,
          ];
        }
      } catch (e) {
        errors = [...errors, `Entry: ${entry.id}, File: ${entry.sfpa}, ${e}`];
      }
      fetched++;
    }

    const CSVBlob = arrayToCSVBlob(finalizedEntries);
    zip.file(`${dictionary.id}.csv`, CSVBlob);

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
