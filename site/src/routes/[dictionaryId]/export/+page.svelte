<script lang="ts">
  import { run } from 'svelte/legacy'

  import DownloadMedia from './DownloadMedia.svelte'
  import { formatCsvEntries, getCsvHeaders, translate_entries } from './prepareEntriesForCsv'
  import type { EntryForCSV } from './prepareEntriesForCsv'
  import { Button, ShowHide } from '$lib/svelte-pieces'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import Progress from '$lib/export/Progress.svelte'
  import { page } from '$app/stores'
  import { downloadObjectsAsCSV } from '$lib/export/csv'

  const { data } = $props()
  const { is_manager, dictionary, auth_user, entries_data, url_from_storage_path } = $derived(data)
  const { loading: entries_loading } = $derived(entries_data)

  let includeImages = $state(false)
  let includeAudio = $state(false)

  let entryHeaders: EntryForCSV = $state({})
  let formattedEntries: EntryForCSV[] = $state([])
  let entriesWithImages: EntryForCSV[] = $state([])
  let entriesWithAudio: EntryForCSV[] = $state([])

  let ready = $state(false)

  run(() => {
    if (!$entries_loading) {
      const translated_entries = translate_entries({ entries: Object.values($entries_data) })
      entryHeaders = getCsvHeaders(translated_entries, dictionary)
      formattedEntries = formatCsvEntries(translated_entries, url_from_storage_path, dictionary)
      // @ts-ignore
      entriesWithImages = formattedEntries.filter(entry => entry?.photoSource)
      entriesWithAudio = formattedEntries.filter(entry => entry?.soundSource)

      ready = true
    }
  })
</script>

<h3 class="export-heading">{$page.data.t('misc.export')}</h3>

{#if is_manager}
  <div style="margin-bottom: 1.5rem">
    <div>
      <i class="far fa-check"></i>
      {$page.data.t('export.csv_data')})
    </div>
    <div class="media-option" class:unavailable={!entriesWithImages.length}>
      <input
        disabled={!entriesWithImages.length}
        id="images"
        type="checkbox"
        bind:checked={includeImages} />
      <label for="images" class="option-label">
        {$page.data.t('misc.images')} ({entriesWithImages.length})</label>
    </div>
    {#if !ready}
      <p class="checking-note">
        {$page.data.t('export.checking_images')}
      </p>
    {:else if !entriesWithImages.length}
      <p class="missing-note">
        {$page.data.t('export.no_images')}
      </p>
    {/if}

    <div class="media-option" class:unavailable={!entriesWithAudio.length}>
      <input id="audio" type="checkbox" bind:checked={includeAudio} />
      <label for="audio" class="option-label">
        {$page.data.t('entry_field.audio')} ({entriesWithAudio.length})</label>
    </div>
    {#if !ready}
      <p class="checking-note">
        {$page.data.t('export.checking_audios')}
      </p>
    {:else if !entriesWithAudio.length}
      <p class="missing-note">
        {$page.data.t('export.no_audios')}
      </p>
    {/if}
  </div>

  {#if includeImages || includeAudio}
    <ShowHide>
      {#snippet children({ show, toggle })}
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
            {dictionary}
            {entryHeaders}
            finalizedEntries={formattedEntries}
            entriesWithImages={includeImages ? entriesWithImages : []}
            entriesWithAudio={includeAudio ? entriesWithAudio : []}
            on:completed={toggle}>
            {#snippet children({ progress })}
              <Progress {progress} />
              {#if progress < 1}
                <Button onclick={toggle} color="red">{$page.data.t('misc.cancel')}</Button>
              {:else}
                <Button onclick={toggle}>{$page.data.t('misc.reset')}</Button>
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
      {$page.data.t('export.download_csv')}
    </Button>
  {/if}
{:else}
  <p>{$page.data.t('export.availability')}</p>
{/if}

{#if auth_user.is_admin}
  <div style="margin-top: 1.25rem">
    <Button form="filled" href='entries?q=%7B"view"%3A"print"%2C"entries_per_page"%3A100%7D'>{$page.data.t('export.download_pdf')}</Button>
  </div>
{/if}

<SeoMetaTags
  norobots={!dictionary.public}
  title={$page.data.t('misc.export')}
  dictionaryName={dictionary.name}
  description="Dictionary managers can easily export their Living Dictionary\'s text data as a .CSV spreadsheet as well as export their images and audio files in convenient ZIP folders."
  keywords="How to print a dictionary, How to create lessons for endangered languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Edit a dictionary, Search a dictionary, Browse a dictionary, Explore a Dictionary" />

<style>
  .export-heading {
    font-size: 1.25rem;
    line-height: 1.75rem;
    font-weight: 600;
    margin-bottom: 1rem;
  }

  .media-option {
    display: flex;
    align-items: center;
    margin-top: 0.5rem;
  }

  .unavailable {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .option-label {
    margin-left: 0.5rem;
    margin-right: 0.5rem;
    display: block;
    line-height: 1.25rem;
    color: var(--color); /* ≈ gray-900 */
  }

  .checking-note {
    font-size: 0.75rem;
    line-height: 1rem;
    font-style: italic;
    color: rgb(251 146 60); /* orange-400 */
    padding: 0.5rem;
  }

  .missing-note {
    font-size: 0.875rem;
    line-height: 1.25rem;
    color: rgb(185 28 28); /* red-700 */
    padding: 0.75rem;
  }
</style>
