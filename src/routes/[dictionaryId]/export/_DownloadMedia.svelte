<script lang="ts">
  import JSZip from 'jszip';
  import { fileAsBlob } from '$lib/export/csv';
  import type { IDictionary } from '$lib/interfaces';
  import { onDestroy, onMount } from 'svelte';
  import { getStorageDownloadUrl } from './_storageUrl';

  export let dictionary: IDictionary;
  export let formattedEntries: any[];
  export let entriesWithImages: any[] = [];
  export let entriesWithAudio: any[] = [];

  let fetched = 0;
  $: progress = fetched / (entriesWithImages.length + entriesWithAudio.length);
  let errors = [];
  let destroyed = false;

  onMount(async () => {
    const zip = new JSZip();

    for (const entry of entriesWithImages) {
      if (destroyed) return;
      console.log('fetching', entry.impa);
      try {
        const response = await fetch(getStorageDownloadUrl(entry.impa));
        if (response.ok) {
          const blob = await response.blob();
          zip.folder(`${dictionary.id}_Images/`).file(entry.imFriendlyName, blob, { binary: true });
        } else {
          errors = [
            ...errors,
            `Entry: ${entry.lx}, Id: ${entry.id}, File: ${entry.impa}, Error: ${response.statusText}`,
          ];
        }
      } catch (e) {
        errors = [...errors, `Entry: ${entry.id}, File: ${entry.impa}, ${e}`];
      }
      fetched++;
    }
    for (const entry of entriesWithAudio) {
      if (destroyed) return;
      console.log('fetching', entry.aupa);
      try {
        const response = await fetch(getStorageDownloadUrl(entry.aupa));
        if (response.ok) {
          const blob = await response.blob();
          zip.folder(`${dictionary.id}_Audio/`).file(entry.auFriendlyName, blob, { binary: true });
        } else {
          errors = [
            ...errors,
            `Entry: ${entry.lx}, Id: ${entry.id}, File: ${entry.aupa}, Error: ${response.status} ${response.statusText}`,
          ];
        }
      } catch (e) {
        errors = [...errors, `Entry: ${entry.id}, File: ${entry.aupa}, ${e}`];
      }
      fetched++;
    }

    console.log('preparing zip');
    for (const entry of formattedEntries) {
      delete entry.impa;
      delete entry.aupa;
    }
    const CSVBlob = fileAsBlob(formattedEntries);
    zip.file(`${dictionary.id}.csv`, CSVBlob);

    const { saveAs } = await import('file-saver');
    await zip.generateAsync({ type: 'blob' }).then((blob) => {
      const d = new Date();
      const date = d.getMonth() + 1 + '_' + d.getDate() + '_' + d.getFullYear();
      if (destroyed) return;
      saveAs(blob, `${dictionary.id}_${date}.zip`);
    });
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
