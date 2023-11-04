<script lang="ts">
  import { onMount } from 'svelte';
  import { t } from 'svelte-i18n';
  import { admin, dictionary, isManager } from '$lib/stores';
  import { Button, ShowHide } from 'svelte-pieces';
  import { partsOfSpeech } from '$lib/mappings/parts-of-speech';
  import type { ActualDatabaseEntry } from '@living-dictionaries/types';
  import { getCollection } from 'sveltefirets';
  import Progress from '$lib/export/Progress.svelte';
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte';
  import { convert_entry_to_current_shape } from '$lib/transformers/convert_entry_to_current_shape';
  import { expand_entry } from '$lib/transformers/expand_entry';
  import DownloadMedia from './DownloadMedia.svelte';
  import { fetchSpeakers } from './fetchSpeakers';
  import { getCsvHeaders, formatCsvEntries, type EntryForCSV } from './prepareEntriesForCsv';
  import { downloadObjectsAsCSV } from '$lib/export/csv';

  let includeImages = false;
  let includeAudio = false;

  let entryHeaders: EntryForCSV = {}
  let formattedEntries: EntryForCSV[] = [];
  let entriesWithImages: EntryForCSV[] = [];
  let entriesWithAudio: EntryForCSV[] = [];

  let mounted = false;

  onMount(async () => {
    const database_entries = await getCollection<ActualDatabaseEntry>(`dictionaries/${$dictionary.id}/words`);
    const converted_to_current_shaped_entries = database_entries.map(convert_entry_to_current_shape);
    const expanded_entries = converted_to_current_shaped_entries.map(expand_entry);
    const speakers = await fetchSpeakers(expanded_entries);

    entryHeaders = getCsvHeaders(expanded_entries, $dictionary)
    formattedEntries = formatCsvEntries(expanded_entries, speakers, partsOfSpeech)
    entriesWithImages = formattedEntries.filter((entry) => entry.image_filename);
    entriesWithAudio = formattedEntries.filter((entry) => entry.sound_filename);

    mounted = true;
  });
</script>

<h3 class="text-xl font-semibold mb-4">{$t('misc.export', { default: 'export' })}</h3>
{#if $isManager}
  <div class="mb-6">
    <div>
      <i class="far fa-check" />
      {$t('export.csv_data', { default: 'Data as .CSV' })} ({$t('export.spreadsheet', { default: 'Spreadsheet' })})
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
        {$t('misc.images', { default: 'Images' })} ({entriesWithImages.length})</label>
    </div>
    {#if !mounted}
      <p class="text-xs italic text-orange-400 p-2">
        {$t('export.checking_images', { default: 'Checking if image files exist' })}
      </p>
    {:else if !entriesWithImages.length}
      <p class="text-sm text-red-700 p-3">
        {$t('export.no_images', { default: 'There are no image files' })}
      </p>
    {/if}

    <div
      class="flex items-center mt-2 {entriesWithAudio.length
        ? ''
        : 'opacity-50 cursor-not-allowed'}">
      <input id="audio" type="checkbox" bind:checked={includeAudio} />
      <label for="audio" class="mx-2 block leading-5 text-gray-900">
        {$t('entry.audio', { default: 'Audio' })} ({entriesWithAudio.length})</label>
    </div>
    {#if !mounted}
      <p class="text-xs italic text-orange-400 p-2">
        {$t('export.checking_audios', { default: 'Checking if audio files exist' })}
      </p>
    {:else if !entriesWithAudio.length}
      <p class="text-sm text-red-700 p-3">
        {$t('export.no_audios', { default: 'There are no audio files' })}
      </p>
    {/if}
  </div>

  {#if includeImages || includeAudio}
    <ShowHide let:show let:toggle>
      {#if !show}
        <Button onclick={toggle} form="filled">
          {$t('export.download_csv', { default: 'Download CSV' })}
          {#if includeImages}
            + {$t('misc.images', { default: 'Images' })}
          {/if}
          {#if includeAudio}
            + {$t('entry.audio', { default: 'Audio' })}
          {/if}
        </Button>
      {:else}
        <DownloadMedia
          dictionary={$dictionary}
          {entryHeaders}
          finalizedEntries={formattedEntries}
          entriesWithImages={includeImages ? entriesWithImages : []}
          entriesWithAudio={includeAudio ? entriesWithAudio : []}
          on:completed={toggle}
          let:progress>
          <Progress {progress} />
          {#if progress < 1}
            <Button onclick={toggle} color="red">{$t('misc.cancel', { default: 'Cancel' })}</Button>
          {:else}
            <Button onclick={toggle}>{$t('misc.reset', { default: 'Reset' })}</Button>
          {/if}
        </DownloadMedia>
      {/if}
    </ShowHide>
  {:else}
    <Button
      loading={!formattedEntries.length}
      onclick={() => {
        downloadObjectsAsCSV(entryHeaders, formattedEntries, $dictionary.id);
      }}
      form="filled">
      {$t('export.download_csv', { default: 'Download CSV' })}
    </Button>
  {/if}
{:else}
  <p>{$t('export.availability', { default: 'Export is only available to dictionary managers' })}</p>
{/if}

{#if $admin}
  <div class="mt-5">
    <Button form="filled" href="entries/print">{$t('export.download_pdf', { default: 'Download PDF' })}</Button>
  </div>
{/if}

<SeoMetaTags
  title={$t('misc.export', { default: 'export' })}
  dictionaryName={$dictionary.name}
  description={$t('', {
    default:
      'Dictionary managers can easily export their Living Dictionary\'s text data as a .CSV spreadsheet as well as export their images and audio files in convenient ZIP folders.',
  })}
  keywords="How to print a dictionary, How to create lessons for endangered languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Edit a dictionary, Search a dictionary, Browse a dictionary, Explore a Dictionary" />
