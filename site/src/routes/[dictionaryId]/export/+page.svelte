<script lang="ts">
  import IconMdiTableLarge from '~icons/mdi/table-large'
  import IconMdiFolderMultipleImage from '~icons/mdi/folder-multiple-image'
  import IconMdiDatabaseOutline from '~icons/mdi/database-outline'
  import IconMdiPrinterOutline from '~icons/mdi/printer-outline'
  import DownloadMediaFiles from './DownloadMediaFiles.svelte'
  import { build_entries_csv } from './entry-csv'
  import { get_media_inventory } from './media-files'
  import type { MediaInventory } from './media-files'
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import { page } from '$app/state'
  import { download_objects_as_csv } from '$lib/export/csv'
  import { toast } from '$lib/state/toast.svelte'

  const { data } = $props()
  const { is_manager, dictionary, auth_user, entries_data, connection, url_from_storage_path } = $derived(data)
  const { loading: entries_loading } = $derived(entries_data)
  const ready = $derived(!$entries_loading)
  const has_entries = $derived(ready && Object.keys($entries_data).length > 0)

  let media = $state<MediaInventory>({ images: [], audio: [], videos: [] })
  $effect(() => {
    if (connection)
      get_media_inventory({ connection, url_from_storage_path }).then(inventory => media = inventory)
  })
  const has_media = $derived(media.images.length || media.audio.length || media.videos.length)

  function download_csv() {
    const { headers, rows } = build_entries_csv(Object.values($entries_data), { dictionary, t: page.data.t, url_from_storage_path })
    download_objects_as_csv(headers, rows, dictionary.id)
  }

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

  <div class="export-cards">
    {#if ready && !has_entries}
      <p class="empty-note">There are no entries to export yet.</p>
    {:else}
      <div class="export-card">
        <div class="card-head">
          <div class="icon-chip" style:--accent="#22c55e">
            <IconMdiTableLarge style="font-size: 1.25rem" />
          </div>
          <h4>{page.data.t('export.csv_title')}</h4>
        </div>
        <p class="description">{page.data.t('export.csv_description')}</p>
        <div>
          <HeadlessButton class="btn-primary btn-default" loading={!ready} onclick={download_csv}>
            {page.data.t('export.download_csv')}
          </HeadlessButton>
        </div>
      </div>

      {#if has_media}
        <div class="export-card">
          <div class="card-head">
            <div class="icon-chip" style:--accent="#ec4899">
              <IconMdiFolderMultipleImage style="font-size: 1.25rem" />
            </div>
            <h4>{page.data.t('export.media_title')}</h4>
          </div>
          <p class="description">{page.data.t('export.media_description')}</p>
          <div class="media-buttons">
            {#if media.images.length}
              <DownloadMediaFiles files={media.images} label={page.data.t('export.download_images')} />
            {/if}
            {#if media.audio.length}
              <DownloadMediaFiles files={media.audio} label={page.data.t('export.download_audio')} />
            {/if}
            {#if media.videos.length}
              <DownloadMediaFiles files={media.videos} label={page.data.t('export.download_videos')} />
            {/if}
          </div>
        </div>
      {/if}
    {/if}

    <div class="export-card">
      <div class="card-head">
        <div class="icon-chip" style:--accent="#6366f1">
          <IconMdiDatabaseOutline style="font-size: 1.25rem" />
        </div>
        <h4>{page.data.t('export.sqlite_title')}</h4>
      </div>
      <p class="description">{page.data.t('export.sqlite_description')}</p>
      <div>
        <HeadlessButton class="btn-primary btn-default" onclick={download_sqlite}>
          {page.data.t('export.download_sqlite')}
        </HeadlessButton>
      </div>
    </div>

    {#if auth_user.is_admin && has_entries}
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
{:else}
  <p>{page.data.t('export.availability')}</p>
{/if}

<SeoMetaTags
  norobots={!dictionary.public}
  title={page.data.t('misc.export')}
  dictionaryName={dictionary.name}
  description="Dictionary managers can export their Living Dictionary's data as a CSV spreadsheet or a complete SQLite database snapshot, and download all of their original image, audio, and video files."
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

  .media-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: flex-start;
  }
</style>
