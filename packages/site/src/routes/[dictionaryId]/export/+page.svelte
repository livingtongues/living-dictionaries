<script lang="ts">
  import { Button, ShowHide } from '$lib/svelte-pieces'
  import DownloadMedia from './DownloadMedia.svelte'
  import { type EntryForCSV, formatCsvEntries, getCsvHeaders, translate_entries } from './prepareEntriesForCsv'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import Progress from '$lib/export/Progress.svelte'
  import { page } from '$app/state'
  import { downloadObjectsAsCSV } from '$lib/export/csv'
  import { dev } from '$app/environment'

  let { data } = $props();
  let { is_manager, dictionary, admin, entries_data, url_from_storage_path } = $derived(data)
  let { loading: entries_loading } = $derived(entries_data)

  let includeImages = $state(false)
  let includeAudio = $state(false)

  let entryHeaders: EntryForCSV = $state({})
  let formattedEntries: EntryForCSV[] = $state([])
  let entriesWithImages: EntryForCSV[] = $state([])
  let entriesWithAudio: EntryForCSV[] = $state([])

  let ready = $state(false)

  $effect(() => {
    if (!$entries_loading) {
      const translated_entries = translate_entries({ entries: Object.values($entries_data) })
      entryHeaders = getCsvHeaders(translated_entries, dictionary)
      formattedEntries = formatCsvEntries(translated_entries, url_from_storage_path, dictionary)
      // @ts-ignore
      entriesWithImages = formattedEntries.filter(entry => entry?.photoSource)
      entriesWithAudio = formattedEntries.filter(entry => entry?.soundSource)

      ready = true
    }
  });
</script>

<h3 class="text-xl font-semibold mb-4">{page.data.t('misc.export')}</h3>

{#if $is_manager}
  <div class="mb-6">
    <div>
      <i class="far fa-check"></i>
      {page.data.t('export.csv_data')})
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
        {page.data.t('misc.images')} ({entriesWithImages.length})</label>
    </div>
    {#if !ready}
      <p class="text-xs italic text-orange-400 p-2">
        {page.data.t('export.checking_images')}
      </p>
    {:else if !entriesWithImages.length}
      <p class="text-sm text-red-700 p-3">
        {page.data.t('export.no_images')}
      </p>
    {/if}

    <div
      class="flex items-center mt-2 {entriesWithAudio.length
        ? ''
        : 'opacity-50 cursor-not-allowed'}">
      <input id="audio" type="checkbox" bind:checked={includeAudio} />
      <label for="audio" class="mx-2 block leading-5 text-gray-900">
        {page.data.t('entry_field.audio')} ({entriesWithAudio.length})</label>
    </div>
    {#if !ready}
      <p class="text-xs italic text-orange-400 p-2">
        {page.data.t('export.checking_audios')}
      </p>
    {:else if !entriesWithAudio.length}
      <p class="text-sm text-red-700 p-3">
        {page.data.t('export.no_audios')}
      </p>
    {/if}
  </div>

  {#if includeImages || includeAudio}
    <ShowHide  >
      {#snippet children({ show, toggle })}
            {#if !show}
          <Button onclick={toggle} form="filled">
            {page.data.t('export.download_csv')}
            {#if includeImages}
              + {page.data.t('misc.images')}
            {/if}
            {#if includeAudio}
              + {page.data.t('entry_field.audio')}
            {/if}
          </Button>
        {:else}
          <DownloadMedia
            {dictionary}
            {entryHeaders}
            finalizedEntries={formattedEntries}
            entriesWithImages={includeImages ? entriesWithImages : []}
            entriesWithAudio={includeAudio ? entriesWithAudio : []}
            on_completed={toggle}
            >
            {#snippet children({ progress })}
                    <Progress {progress} />
              {#if progress < 1}
                <Button onclick={toggle} color="red">{page.data.t('misc.cancel')}</Button>
              {:else}
                <Button onclick={toggle}>{page.data.t('misc.reset')}</Button>
              {/if}
                              {/snippet}
                </DownloadMedia>
        {/if}
                {/snippet}
        </ShowHide>
  {:else}
    <Button
      loading={!formattedEntries.length}
      onclick={() => {
        downloadObjectsAsCSV(entryHeaders, formattedEntries, dictionary.id)
      }}
      form="filled">
      {page.data.t('export.download_csv')}
    </Button>
  {/if}
{:else}
  <p>{page.data.t('export.availability')}</p>
{/if}

{#if $admin}
  <div class="mt-5">
    <Button form="filled" href='entries?q=%7B"view"%3A"print"%2C"entries_per_page"%3A100%7D'>{page.data.t('export.download_pdf')}</Button>
  </div>
{/if}

{#if $admin || dev}
  <div class="mt-2">
    <a href="/{dictionary.id}/keys" class="text-sm text-gray-500 hover:underline">API Keys</a>
  </div>
{/if}

<SeoMetaTags
  norobots={!dictionary.public}
  title={page.data.t('misc.export')}
  dictionaryName={dictionary.name}
  description="Dictionary managers can easily export their Living Dictionary\'s text data as a .CSV spreadsheet as well as export their images and audio files in convenient ZIP folders."
  keywords="How to print a dictionary, How to create lessons for endangered languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Edit a dictionary, Search a dictionary, Browse a dictionary, Explore a Dictionary" />
