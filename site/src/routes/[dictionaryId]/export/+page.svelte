<script lang="ts">
  import IconMdiTableLarge from '~icons/mdi/table-large'
  import IconMdiDatabaseOutline from '~icons/mdi/database-outline'
  import IconMdiPrinterOutline from '~icons/mdi/printer-outline'
  import DownloadMedia from './DownloadMedia.svelte'
  import { formatCsvEntries, getCsvHeaders, translate_entries } from './prepare-entries-for-csv'
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import Progress from '$lib/export/Progress.svelte'
  import { page } from '$app/state'
  import { download_objects_as_csv } from '$lib/export/csv'
  import { toast } from '$lib/state/toast.svelte'

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

  $effect(() => {
    if (!entriesWithImages.length) includeImages = false
    if (!entriesWithAudio.length) includeAudio = false
  })

  async function download_sqlite() {
    try {
      const response = await fetch(`/api/dictionary/${dictionary.id}/db`, { credentials: 'include' })
      if (!response.ok)
        throw new Error(`${response.status}`)
      const blob = await response.blob()
      const object_url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = object_url
      anchor.download = `${dictionary.id}.db`
      anchor.click()
      URL.revokeObjectURL(object_url)
    } catch (err) {
      console.error(err)
      toast(page.data.t('export.sqlite_failed'), { theme: 'red' })
    }
  }
</script>

<h3 class="export-heading">{page.data.t('misc.export')}</h3>

{#if is_manager}
  <p class="intro">{page.data.t('export.intro')}</p>

  {#if ready && !has_entries}
    <p class="empty-note">There are no entries to export yet.</p>
  {:else}
    <div class="export-cards">
      <div class="export-card">
        <div class="card-head">
          <div class="icon-chip" style:--accent="#22c55e">
            <IconMdiTableLarge style="font-size: 1.25rem" />
          </div>
          <h4>{page.data.t('export.csv_title')}</h4>
        </div>
        <p class="description">{page.data.t('export.csv_description')}</p>

        {#if !ready}
          <p class="checking-note">{page.data.t('export.checking_images')}</p>
          <p class="checking-note">{page.data.t('export.checking_audios')}</p>
        {:else if entriesWithImages.length || entriesWithAudio.length}
          <div class="media-options">
            {#if entriesWithImages.length}
              <label class="media-option">
                <input type="checkbox" bind:checked={includeImages} />
                {page.data.t('misc.images')} ({entriesWithImages.length})
              </label>
            {/if}
            {#if entriesWithAudio.length}
              <label class="media-option">
                <input type="checkbox" bind:checked={includeAudio} />
                {page.data.t('entry_field.audio')} ({entriesWithAudio.length})
              </label>
            {/if}
          </div>
        {/if}

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
                  on_completed={toggle}>
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
          <div>
            <HeadlessButton
              class="btn-primary btn-default"
              loading={!ready}
              onclick={() => download_objects_as_csv(entryHeaders, formattedEntries, dictionary.id)}>
              {page.data.t('export.download_csv')}
            </HeadlessButton>
          </div>
        {/if}
      </div>

      <div class="export-card">
        <div class="card-head">
          <div class="icon-chip" style:--accent="#6366f1">
            <IconMdiDatabaseOutline style="font-size: 1.25rem" />
          </div>
          <h4>{page.data.t('export.sqlite_title')}</h4>
        </div>
        <p class="description">{page.data.t('export.sqlite_description')}</p>
        <p class="description secondary">{page.data.t('export.sqlite_note')}</p>
        <div>
          <HeadlessButton class="btn-primary btn-default" onclick={download_sqlite}>
            {page.data.t('export.download_sqlite')}
          </HeadlessButton>
        </div>
      </div>

      {#if auth_user.is_admin}
        <div class="export-card">
          <div class="card-head">
            <div class="icon-chip" style:--accent="#f59e0b">
              <IconMdiPrinterOutline style="font-size: 1.25rem" />
            </div>
            <h4>{page.data.t('export.pdf_title')}</h4>
          </div>
          <p class="description">{page.data.t('export.pdf_description')}</p>
          <div>
            <a class="btn-primary btn-default" href='entries?q=%7B"view"%3A"print"%2C"entries_per_page"%3A100%7D'>{page.data.t('export.download_pdf')}</a>
          </div>
        </div>
      {/if}
    </div>
  {/if}
{:else}
  <p>{page.data.t('export.availability')}</p>
{/if}

<SeoMetaTags
  norobots={!dictionary.public}
  title={page.data.t('misc.export')}
  dictionaryName={dictionary.name}
  description="Dictionary managers can easily export their Living Dictionary\'s text data as a .CSV spreadsheet or a full SQLite database snapshot, as well as export their images and audio files in convenient ZIP folders."
  keywords="How to print a dictionary, How to create lessons for endangered languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Edit a dictionary, Search a dictionary, Browse a dictionary, Explore a Dictionary" />

<style>
  .export-heading {
    font-size: 1.25rem;
    line-height: 1.75rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .intro {
    color: var(--color-secondary);
    line-height: 1.5;
    margin-bottom: 1.25rem;
    max-width: 40rem;
  }

  .empty-note {
    color: var(--color-secondary);
  }

  .export-cards {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 40rem;
  }

  .export-card {
    background: var(--surface);
    border-radius: 0.75rem;
    padding: 1rem 1.25rem 1.25rem;
  }

  .card-head {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .card-head h4 {
    margin: 0;
    font-size: 1.0625rem;
    font-weight: 600;
  }

  .icon-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 0.5rem;
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, transparent);
  }

  .description {
    line-height: 1.5;
    margin: 0 0 0.75rem;
  }

  .description.secondary {
    color: var(--color-secondary);
    font-size: 0.875rem;
  }

  .media-options {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 1.25rem;
    margin-bottom: 0.875rem;
  }

  .media-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    line-height: 1.25rem;
    color: var(--color);
    cursor: pointer;
  }

  .checking-note {
    font-size: 0.75rem;
    line-height: 1rem;
    font-style: italic;
    color: var(--warning);
    margin: 0 0 0.5rem;
  }
</style>
