<script lang="ts">
  import { Modal } from 'svelte-pieces'
  import { readable } from 'svelte/store'
  import EntryPage from '../entry/[entryId]/+page.svelte'
  import ListEntry from './list/ListEntry.svelte'
  import EntriesTable from './table/EntriesTable.svelte'
  import type { PageData as EntriesPageData } from './$types'
  import EntriesGallery from './EntriesGallery.svelte'
  import EntriesPrint from './EntriesPrint.svelte'
  import { pushState } from '$app/navigation'
  import { page } from '$app/stores'
  import type { EntryData } from '$lib/search/types'

  export let entries: EntryData[]
  export let page_data: EntriesPageData
  $: ({ dictionary, can_edit, preferred_table_columns, dbOperations, search_params } = page_data)

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
  {#if !$search_params.view}
    {#each entries as entry (entry.id)}
      <ListEntry
        {dictionary}
        {entry}
        can_edit={$can_edit}
        on_click={(e) => { handle_entry_click(e, entry) }}
        {dbOperations} />

      {#if $page.state.entry_id === entry.id}
        <Modal noscroll class="sm:max-w-95vw xl:max-w-1100px" on_close={() => history.back()} show_x={false}>
          <EntryPage
            data={{
              ...page_data,
              entry_from_page: entry,
              shallow: true,
              entry_history: readable([]),
            }} />
        </Modal>
      {/if}
    {/each}
  {:else if $search_params.view === 'table'}
    <EntriesTable
      {entries}
      preferred_table_columns={$preferred_table_columns}
      {dictionary}
      can_edit={$can_edit}
      {dbOperations} />
  {:else if $search_params.view === 'gallery'}
    <EntriesGallery
      {entries}
      {dictionary}
      can_edit={$can_edit} />
  {:else if $search_params.view === 'print'}
    <EntriesPrint
      {search_params}
      {entries}
      {dictionary}
      can_edit={$can_edit} />
  {/if}
{/if}
