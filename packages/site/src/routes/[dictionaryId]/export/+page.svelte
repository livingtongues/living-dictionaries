<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { admin, dictionary_deprecated as dictionary, isManager } from '$lib/stores';
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
    const expanded_entries = converted_to_current_shaped_entries.map(entry => expand_entry(entry, $page.data.t));
    const speakers = await fetchSpeakers(expanded_entries);

    entryHeaders = getCsvHeaders(expanded_entries, $dictionary)
    formattedEntries = formatCsvEntries(expanded_entries, speakers, partsOfSpeech)
    entriesWithImages = formattedEntries.filter((entry) => entry.image_filename);
    entriesWithAudio = formattedEntries.filter((entry) => entry.sound_filename);

    mounted = true;
  });
</script>

<h3 class="text-xl font-semibold mb-4">{$page.data.t('misc.export')}</h3>
{#if $isManager}
  <div class="mb-6">
    <div>
      <i class="far fa-check" />
      {$page.data.t('export.csv_data')})
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
        {$page.data.t('misc.images')} ({entriesWithImages.length})</label>
    </div>
    {#if !mounted}
      <p class="text-xs italic text-orange-400 p-2">
        {$page.data.t('export.checking_images')}
      </p>
    {:else if !entriesWithImages.length}
      <p class="text-sm text-red-700 p-3">
        {$page.data.t('export.no_images')}
      </p>
    {/if}

    <div
      class="flex items-center mt-2 {entriesWithAudio.length
        ? ''
        : 'opacity-50 cursor-not-allowed'}">
      <input id="audio" type="checkbox" bind:checked={includeAudio} />
      <label for="audio" class="mx-2 block leading-5 text-gray-900">
        {$page.data.t('entry_field.audio')} ({entriesWithAudio.length})</label>
    </div>
    {#if !mounted}
      <p class="text-xs italic text-orange-400 p-2">
        {$page.data.t('export.checking_audios')}
      </p>
    {:else if !entriesWithAudio.length}
      <p class="text-sm text-red-700 p-3">
        {$page.data.t('export.no_audios')}
      </p>
    {/if}
  </div>

  {#if includeImages || includeAudio}
    <ShowHide let:show let:toggle>
      {#if !show}
        <Button onclick={toggle} form="filled">
          {$page.data.t('export.download_csv')}
          {#if includeImages}
            + {$page.data.t('misc.images')}
          {/if}
          {#if includeAudio}
            + {$page.data.t('entry_field.audio')}
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
            <Button onclick={toggle} color="red">{$page.data.t('misc.cancel')}</Button>
          {:else}
            <Button onclick={toggle}>{$page.data.t('misc.reset')}</Button>
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
      {$page.data.t('export.download_csv')}
    </Button>
  {/if}
{:else}
  <p>{$page.data.t('export.availability')}</p>
{/if}

{#if $admin}
  <div class="mt-5">
    <Button form="filled" href="entries/print">{$page.data.t('export.download_pdf')}</Button>
  </div>
{/if}

<SeoMetaTags
  title={$page.data.t('misc.export')}
  dictionaryName={$dictionary.name}
  description="Dictionary managers can easily export their Living Dictionary\'s text data as a .CSV spreadsheet as well as export their images and audio files in convenient ZIP folders."
  keywords="How to print a dictionary, How to create lessons for endangered languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Edit a dictionary, Search a dictionary, Browse a dictionary, Explore a Dictionary" />
