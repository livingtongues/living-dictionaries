<script lang="ts">
  import { readable } from 'svelte/store'
  import type { EntryData } from '$lib/types'
  import EntryPage from '../entry/[entryId]/+page.svelte'
  import ListEntry from './list/ListEntry.svelte'
  import EntriesTable from './table/EntriesTable.svelte'
  import type { PageData as EntriesPageData } from './$types'
  import EntriesGallery from './EntriesGallery.svelte'
  import EntriesPrint from './EntriesPrint.svelte'
  import Modal from '$lib/components/ui/Modal.svelte'
  import { pushState } from '$app/navigation'
  import { page } from '$app/state'
  import { browser } from '$app/environment'
  import { log_warning } from '$lib/debug/remote-log'

  interface Props {
    entries: EntryData[]
    page_data: EntriesPageData
  }

  const { entries, page_data }: Props = $props()
  const { dictionary, can_edit, preferred_table_columns, writes, search_params } = $derived(page_data)

  // Defensive boundary around the results render. A client-local corruption of the
  // local dict.db (or a would-be render recursion) must not white-screen the whole
  // page — and the guard-log names its context so the next occurrence is legible
  // instead of a minified stack. Grounded in the 2026-07-07 highlander table-view
  // `RangeError: Maximum call stack` (`Sk@/Qk@`), which was client-local + never
  // reproducible from server data. See
  // `.issues/highlander-table-view-stack-overflow-2026-07-07.md`. Mirrors the
  // `entry_render_duplicate_key` guard-log (`$lib/utils/dedupe-keyed-children.ts`).
  function on_render_error(error: unknown) {
    if (!browser) return // SSR data is clean (the corruption is client-local); avoid log_warning's localStorage path
    log_warning({
      message: 'entries_view_render_failed',
      context: {
        dict_id: dictionary?.id ?? null,
        view: search_params.value.view ?? 'list',
        entry_count: entries?.length ?? 0,
        first_entry_ids: (entries ?? []).slice(0, 5).map(entry => entry.id),
        error: error instanceof Error ? error.message : String(error),
      },
    })
  }

  function handle_entry_click(e: MouseEvent & { currentTarget: EventTarget & HTMLAnchorElement }, entry: EntryData) {
    // bail if opening a new tab
    if (e.metaKey || e.ctrlKey) return
    e.preventDefault() // prevent navigation
    // if also on small screen then add `window.innerWidth < 640`

    const { href } = e.currentTarget
    const { search, hash } = window.location
    pushState(`${href}${search}${hash}`, { entry_id: entry.id })
  }
</script>

{#if entries?.length}
  <svelte:boundary onerror={on_render_error}>
    {#if !search_params.value.view}
      {#each entries as entry (entry.id)}
        <ListEntry
          {dictionary}
          {entry}
          can_edit={can_edit}
          on_click={(e) => { handle_entry_click(e, entry) }}
          {writes} />

        {#if page.state.entry_id === entry.id}
          <Modal noscroll class="entry-overlay-modal" on_close={() => history.back()} show_x={false}>
            <EntryPage
              data={{
                ...page_data,
                entry_from_page: entry,
                shallow: true,
              }} />
          </Modal>
        {/if}
      {/each}
    {:else if search_params.value.view === 'table'}
      <EntriesTable
        {entries}
        preferred_table_columns={preferred_table_columns.value}
        {dictionary}
        can_edit={can_edit}
        {writes} />
    {:else if search_params.value.view === 'gallery'}
      <EntriesGallery
        {entries}
        {dictionary}
        can_edit={can_edit} />
    {:else if search_params.value.view === 'print'}
      <EntriesPrint
        {search_params}
        {entries}
        {dictionary}
        can_edit={can_edit} />
    {/if}

    {#snippet failed(_error, reset)}
      <div class="render-failed" role="alert">
        <p>{page.data.t('misc.error')}</p>
        <button type="button" class="btn-outline" onclick={reset}>{page.data.t('misc.reload')}</button>
      </div>
    {/snippet}
  </svelte:boundary>
{/if}

<style>
  /* The Modal portals to body, so these can't be ancestor-scoped; the extra `div`
     keeps them above the modal panel's own max-width (was `sm:max-w-95vw xl:max-w-1100px`). */
  @media (min-width: 640px) {
    :global(div.entry-overlay-modal) {
      max-width: 95vw;
    }
  }

  @media (min-width: 1280px) {
    :global(div.entry-overlay-modal) {
      max-width: 1100px;
    }
  }

  .render-failed {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 2rem 1rem;
    color: var(--color-secondary);
    text-align: center;
  }
</style>
