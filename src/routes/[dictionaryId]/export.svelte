<script lang="ts">
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import { dictionary } from '$lib/stores';
  import Button from '$svelteui/ui/Button.svelte';
  import { formatEntriesForCSV } from './export/_formatEntries';
  import type { IEntry } from '$lib/interfaces';
  import { getCollection } from '$sveltefire/firestore';
  import { downloadObjArrAsCSV } from '$lib/export/csv';
  import ShowHide from '$svelteui/functions/ShowHide.svelte';
  import DownloadMedia from './export/_DownloadMedia.svelte';
  import Progress from './export/_Progress.svelte';

  let includeImages = false;
  let includeAudio = false;

  let formattedEntries: any[] = [];
  let entriesWithImages: any[] = [];
  let entriesWithAudio: any[] = [];
  let mounted = false;

  onMount(async () => {
    const entries = await getCollection<IEntry>(`dictionaries/${$dictionary.id}/words`);
    formattedEntries = await formatEntriesForCSV(entries, $dictionary);
    entriesWithImages = formattedEntries.filter((entry) => entry.impa);
    entriesWithAudio = formattedEntries.filter((entry) => entry.aupa);
    mounted = true;
  });

  // TODO:
  // use already established naming conventions (sf (soundfile) instead of au, pf (photofile) instead of im)
  // put quotes around items that have commas instead of pulling out all commas and just do it at the end.
  // Type things
  // Test things
  // Don't use JSON.parse and Object.assign when it makes code more verbose for no benefit
  // use const ... for ... loops instead of the old style that is more verbose and confusing.
  // don't fetch all speakers - just get ones for current dictionary
  // XSLX option (see git history)
</script>

<svelte:head>
  <title>
    {$dictionary.name}
    {$_('misc.export', { default: 'export' })}
  </title>
</svelte:head>

<h3 class="text-xl font-semibold mb-4">{$_('misc.export', { default: 'export' })}</h3>

<div class="mb-6">
  <div>
    <i class="far fa-check" /> Data as CSV
  </div>
  <div
    class="flex items-center mt-2 {entriesWithImages.length
      ? ''
      : 'opacity-50 cursor-not-allowed'}">
    <input
      disabled={!entriesWithImages.length}
      id="images"
      type="checkbox"
      bind:checked={includeImages} />
    <label for="images" class="mx-2 block leading-5 text-gray-900">
      Images ({entriesWithImages.length})</label>
  </div>
  {#if !mounted}
    <p class="text-xs italic text-orange-400 p-2">Checking if images exist</p>
  {:else if !entriesWithImages.length}
    <p class="text-sm text-red-700 p-3">There are no images</p>
  {/if}

  <div
    class="flex items-center mt-2 {entriesWithAudio.length ? '' : 'opacity-50 cursor-not-allowed'}">
    <input id="audio" type="checkbox" bind:checked={includeAudio} />
    <label for="audio" class="mx-2 block leading-5 text-gray-900">
      Audio ({entriesWithAudio.length})</label>
  </div>
  {#if !mounted}
    <p class="text-xs italic text-orange-400 p-2">Checking if audio files exist</p>
  {:else if !entriesWithAudio.length}
    <p class="text-sm text-red-700 p-3">There are no audio files</p>
  {/if}
</div>

{#if includeImages || includeAudio}
  <ShowHide let:show let:toggle>
    {#if !show}
      <Button onclick={toggle} form="primary">
        Download CSV
        {#if includeImages}
          + Images
        {/if}
        {#if includeAudio}
          + Audio
        {/if}
      </Button>
    {:else}
      <DownloadMedia
        dictionary={$dictionary}
        {formattedEntries}
        entriesWithImages={includeImages ? entriesWithImages : []}
        entriesWithAudio={includeAudio ? entriesWithAudio : []}
        let:progress>
        <Progress {progress} />
        {#if progress < 1}
          <Button onclick={toggle} color="red">Cancel</Button>
        {:else}
          <Button onclick={toggle}>Reset</Button>
        {/if}
      </DownloadMedia>
    {/if}
  </ShowHide>
{:else}
  <Button
    disabled={!formattedEntries.length}
    onclick={() => {
      const finalizedEntries = formattedEntries.map((entry) => {
        delete entry.impa;
        delete entry.aupa;
        return entry;
      });
      downloadObjArrAsCSV(finalizedEntries, $dictionary.name);
    }}
    form="primary">
    Download CSV
  </Button>
{/if}
