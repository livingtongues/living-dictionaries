<script lang="ts">
  import { readable } from 'svelte/store'
  import type { ExpandedEntry } from '@living-dictionaries/types'
  import { Modal } from 'svelte-pieces'
  import EntryPage from '../entry/[entryId]/+page.svelte'
  import type { PageData as EntryPageData } from '../entry/[entryId]/$types'
  import ListEntry from './list/ListEntry.svelte'
  import EntriesTable from './table/EntriesTable.svelte'
  import type { PageData as EntriesPageData } from './$types'
  import EntriesGallery from './EntriesGallery.svelte'
  import EntriesPrint from './EntriesPrint.svelte'
  import { goto, preloadData, pushState } from '$app/navigation'
  import { page } from '$app/stores'
  import { ResponseCodes } from '$lib/constants'

  export let entries: Map<string, ExpandedEntry>
  export let page_data: EntriesPageData
  $: ({ dictionary, admin, can_edit, preferred_table_columns, dbOperations, search_params, load_citation, load_partners } = page_data)

  let entry_page_data: EntryPageData

  async function handle_entry_click(e: MouseEvent & { currentTarget: EventTarget & HTMLAnchorElement }, entry: ExpandedEntry) {
    // bail if opening a new tab // or small screen  || window.innerWidth < 640
    if (e.metaKey || e.ctrlKey) return
    e.preventDefault() // prevent navigation

    entry_page_data = {
      ...page_data,
      entry: readable(entry),
      supa_entry: new Promise(() => ({})),
      shallow: true,
    }

    const { href } = e.currentTarget
    const { search, hash } = window.location
    pushState(`${href}${search}${hash}`, { entry_id: entry.id })

    const result = await preloadData(href)
    if (result.type === 'loaded' && result.status === ResponseCodes.OK) {
      // @ts-expect-error
      entry_page_data = result.data
    } else {
      goto(href)
    }
  }
</script>

{#if entries.size}
  {#if !$search_params.view}
    {#each entries as [id, entry] (id)}
      <ListEntry
        dictionary={$dictionary}
        {entry}
        videoAccess={$dictionary.videoAccess || $admin > 0}
        can_edit={$can_edit}
        on_click={(e) => { handle_entry_click(e, entry) }}
        {dbOperations} />
    {/each}
  {:else if $search_params.view === 'table'}
    <EntriesTable
      entries={Array.from(entries.values())}
      preferred_table_columns={$preferred_table_columns}
      dictionary={$dictionary}
      can_edit={$can_edit}
      {dbOperations} />
  {:else if $search_params.view === 'gallery'}
    <EntriesGallery
      entries={Array.from(entries.values())}
      dictionary={$dictionary}
      deleteImage={dbOperations.deleteImage}
      can_edit={$can_edit} />
  {:else if $search_params.view === 'print'}
    <EntriesPrint
      {search_params}
      entries={Array.from(entries.values())}
      dictionary={$dictionary}
      {load_citation}
      {load_partners}
      can_edit={$can_edit} />
  {/if}
{/if}

{#if $page.state.entry_id}
  <Modal noscroll class="sm:max-w-95vw xl:max-w-1100px" on_close={() => history.back()} show_x={false}>
    <EntryPage
      data={{
        ...entry_page_data,
        shallow: true,
      }} />
  </Modal>
{/if}
