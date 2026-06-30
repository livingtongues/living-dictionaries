<script lang="ts">
  import IconMdiCheck from '~icons/mdi/check'
  import DownloadMedia from './DownloadMedia.svelte'
  import { formatCsvEntries, getCsvHeaders, translate_entries } from './prepareEntriesForCsv'
  import { HeadlessButton, ShowHide } from '$lib/svelte-pieces'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import Progress from '$lib/export/Progress.svelte'
  import { page } from '$app/state'
  import { downloadObjectsAsCSV } from '$lib/export/csv'

  const { data } = $props()
  const { is_manager, dictionary, auth_user, entries_data, url_from_storage_path } = $derived(data)
  const { loading: entries_loading } = $derived(entries_data)
  const ready = $derived(!$entries_loading)

  let includeImages = $state(false)
  let includeAudio = $state(false)

  const translated_entries = $derived(ready
    ? translate_entries({ entries: Object.values($entries_data), t: page.data.t, url_from_storage_path })
    : [])
  const entryHeaders = $derived(getCsvHeaders(translated_entries, dictionary))
  const formattedEntries = $derived(ready ? formatCsvEntries(translated_entries, url_from_storage_path, dictionary) : [])
  const entriesWithImages = $derived(formattedEntries.filter(entry => (entry as Record<string, string>)?.photoSource))
  const entriesWithAudio = $derived(formattedEntries.filter(entry => entry?.soundSource))
  const has_entries = $derived(formattedEntries.length > 0)
</script>

<h3 class="export-heading">{page.data.t('misc.export')}</h3>

{#if is_manager}
  {#if ready && !has_entries}
    <p class="empty-note">There are no entries to export yet.</p>
  {:else}
    <div class="options">
      <div class="csv-row">
        <IconMdiCheck style="color: var(--success)" />
        {page.data.t('export.csv_data')}
      </div>

      <div class="media-option" class:unavailable={!entriesWithImages.length}>
        <input
          disabled={!entriesWithImages.length}
          id="images"
          type="checkbox"
          bind:checked={includeImages} />
        <label for="images" class="option-label">
          {page.data.t('misc.images')} ({entriesWithImages.length})</label>
      </div>
      {#if !ready}
        <p class="checking-note">{page.data.t('export.checking_images')}</p>
      {:else if !entriesWithImages.length}
        <p class="missing-note">{page.data.t('export.no_images')}</p>
      {/if}

      <div class="media-option" class:unavailable={!entriesWithAudio.length}>
        <input
          disabled={!entriesWithAudio.length}
          id="audio"
          type="checkbox"
          bind:checked={includeAudio} />
        <label for="audio" class="option-label">
          {page.data.t('entry_field.audio')} ({entriesWithAudio.length})</label>
      </div>
      {#if !ready}
        <p class="checking-note">{page.data.t('export.checking_audios')}</p>
      {:else if !entriesWithAudio.length}
        <p class="missing-note">{page.data.t('export.no_audios')}</p>
      {/if}
    </div>

    {#if includeImages || includeAudio}
      <ShowHide>
        {#snippet children({ show, toggle })}
          {#if !show}
            <button type="button" class="btn-primary btn-default" onclick={toggle}>
              {page.data.t('export.download_csv')}
              {#if includeImages}
                + {page.data.t('misc.images')}
              {/if}
              {#if includeAudio}
                + {page.data.t('entry_field.audio')}
              {/if}
            </button>
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
                  <button type="button" class="btn-outline btn-default" style="color: var(--danger)" onclick={toggle}>{page.data.t('misc.cancel')}</button>
                {:else}
                  <button type="button" class="btn btn-default" onclick={toggle}>{page.data.t('misc.reset')}</button>
                {/if}
              {/snippet}
            </DownloadMedia>
          {/if}
        {/snippet}
      </ShowHide>
    {:else}
      <HeadlessButton
        class="btn-primary btn-default"
        loading={!ready}
        onclick={() => downloadObjectsAsCSV(entryHeaders, formattedEntries, dictionary.id)}>
        {page.data.t('export.download_csv')}
      </HeadlessButton>
    {/if}
  {/if}
{:else}
  <p>{page.data.t('export.availability')}</p>
{/if}

{#if auth_user.is_admin}
  <div style="margin-top: 1.25rem">
    <a class="btn-primary btn-default" href='entries?q=%7B"view"%3A"print"%2C"entries_per_page"%3A100%7D'>{page.data.t('export.download_pdf')}</a>
  </div>
{/if}

<SeoMetaTags
  norobots={!dictionary.public}
  title={page.data.t('misc.export')}
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

  .empty-note {
    color: var(--color-secondary);
  }

  .options {
    margin-bottom: 1.5rem;
  }

  .csv-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
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
    color: var(--color);
  }

  .checking-note {
    font-size: 0.75rem;
    line-height: 1rem;
    font-style: italic;
    color: var(--warning);
    padding: 0.5rem;
  }

  .missing-note {
    font-size: 0.875rem;
    line-height: 1.25rem;
    color: var(--danger);
    padding: 0.5rem 0.75rem;
  }
</style>
