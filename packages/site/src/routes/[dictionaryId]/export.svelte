<script lang="ts">
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import { dictionary, isManager } from '$lib/stores';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import { formatEntriesForCSV, type IEntryForCSV } from '$lib/export/formatEntries';
  import { semanticDomains, partsOfSpeech } from '@living-dictionaries/parts';
  import type { IEntry } from '@living-dictionaries/types';
  import { getCollection } from 'sveltefirets';
  import { downloadBlob, arrayToCSVBlob } from '$lib/export/csv';
  import ShowHide from 'svelte-pieces/functions/ShowHide.svelte';
  import DownloadMedia from '../../lib/export/DownloadMedia.svelte';
  import Progress from '$lib/export/Progress.svelte';
  import { fetchSpeakers } from '$lib/helpers/fetchSpeakers';

  let includeImages = false;
  let includeAudio = false;
  let formattedEntries: IEntryForCSV[] = [];
  let entriesWithImages: IEntryForCSV[] = [];
  let entriesWithAudio: IEntryForCSV[] = [];
  let finalizedEntries: IEntryForCSV[] = [];
  let mounted = false;

  onMount(async () => {
    const entries = await getCollection<IEntry>(`dictionaries/${$dictionary.id}/words`);
    const speakers = await fetchSpeakers(entries);
    formattedEntries = formatEntriesForCSV(
      entries,
      $dictionary,
      speakers,
      semanticDomains,
      partsOfSpeech
    );
    entriesWithImages = formattedEntries.filter((entry) => entry.pfpa);
    entriesWithAudio = formattedEntries.filter((entry) => entry.sfpa);
    finalizedEntries = formattedEntries.map((entry) => {
      const newEntry = { ...entry };
      delete newEntry.pfpa;
      delete newEntry.sfpa;
      return newEntry;
    });
    mounted = true;
  });
</script>

<svelte:head>
  <title>
    {$dictionary.name}
    {$_('misc.export', { default: 'export' })}
  </title>
</svelte:head>

<h3 class="text-xl font-semibold mb-4">{$_('misc.export', { default: 'export' })}</h3>
{#if $isManager}
  <div class="mb-6">
    <div>
      <i class="far fa-check" />
      {$_('export.csv_data', { default: 'Data as CSV' })}
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
        {$_('misc.images', { default: 'Images' })} ({entriesWithImages.length})</label>
    </div>
    {#if !mounted}
      <p class="text-xs italic text-orange-400 p-2">
        {$_('export.checking_images', { default: 'Checking if image files exist' })}
      </p>
    {:else if !entriesWithImages.length}
      <p class="text-sm text-red-700 p-3">
        {$_('export.no_images', { default: 'There are no image files' })}
      </p>
    {/if}

    <div
      class="flex items-center mt-2 {entriesWithAudio.length
        ? ''
        : 'opacity-50 cursor-not-allowed'}">
      <input id="audio" type="checkbox" bind:checked={includeAudio} />
      <label for="audio" class="mx-2 block leading-5 text-gray-900">
        {$_('entry.audio', { default: 'Audio' })} ({entriesWithAudio.length})</label>
    </div>
    {#if !mounted}
      <p class="text-xs italic text-orange-400 p-2">
        {$_('export.checking_audios', { default: 'Checking if audio files exist' })}
      </p>
    {:else if !entriesWithAudio.length}
      <p class="text-sm text-red-700 p-3">
        {$_('export.no_audios', { default: 'There are no audio files' })}
      </p>
    {/if}
  </div>

  {#if includeImages || includeAudio}
    <ShowHide let:show let:toggle>
      {#if !show}
        <Button onclick={toggle} form="filled">
          {$_('export.download_csv', { default: 'Download CSV' })}
          {#if includeImages}
            + {$_('misc.images', { default: 'Images' })}
          {/if}
          {#if includeAudio}
            + {$_('entry.audio', { default: 'Audio' })}
          {/if}
        </Button>
      {:else}
        <DownloadMedia
          dictionary={$dictionary}
          {finalizedEntries}
          entriesWithImages={includeImages ? entriesWithImages : []}
          entriesWithAudio={includeAudio ? entriesWithAudio : []}
          on:completed={toggle}
          let:progress>
          <Progress {progress} />
          {#if progress < 1}
            <Button onclick={toggle} color="red">{$_('misc.cancel', { default: 'Cancel' })}</Button>
          {:else}
            <Button onclick={toggle}>{$_('misc.reset', { default: 'Reset' })}</Button>
          {/if}
        </DownloadMedia>
      {/if}
    </ShowHide>
  {:else}
    <Button
      loading={!finalizedEntries.length}
      onclick={() => {
        const blob = arrayToCSVBlob(finalizedEntries);
        downloadBlob(blob, $dictionary.id, '.csv');
      }}
      form="filled">
      {$_('export.download_csv', { default: 'Download CSV' })}
    </Button>
  {/if}
{:else}
  <p>{$_('export.availability', { default: 'Export is only available to dictionary managers' })}</p>
{/if}
