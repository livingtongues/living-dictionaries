<script lang="ts">
  import ListEntry from '../entries/list/ListEntry.svelte';
  import { readable } from 'svelte/store';
  import type { ExpandedEntry } from '@living-dictionaries/types';
  import { page } from '$app/stores';
  import { Modal } from 'svelte-pieces';
  import { goto, preloadData, pushState } from '$app/navigation';
  import EntryPage from '../entry/[entryId]/+page.svelte';
  import { ResponseCodes } from '$lib/constants';
  import type { PageData as EntryPageData } from '../entry/[entryId]/$types';
  import type { PageData as EntriesPageData } from './$types';
  import type { View } from '$lib/search/types';
  import EntriesTable from '../entries/table/EntriesTable.svelte';

  export let view: View
  export let entries: Map<string, ExpandedEntry>
  export let page_data: EntriesPageData
  $: ({ dictionary, can_edit, preferred_table_columns, dbOperations} = page_data)

  let entry_page_data: EntryPageData

  async function handle_entry_click(e: MouseEvent & { currentTarget: EventTarget & HTMLAnchorElement }, entry: ExpandedEntry) {
    // bail if opening a new tab // or small screen  || window.innerWidth < 640
    if (e.metaKey || e.ctrlKey) return;
    e.preventDefault(); // prevent navigation

    // @ts-expect-error
    console.info({opened: entry, lexeme_other: entry.lexeme_other?.join(', ')})

    entry_page_data = {
      ...page_data,
      entry: readable(entry),
      supa_entry: new Promise(() => ({})),
      shallow: true,
    }

    const { href } = e.currentTarget;
    const { search, hash } = window.location
    pushState(`${href}${search}${hash}`, { entry_id: entry.id});

    const result = await preloadData(href);
    if (result.type === 'loaded' && result.status === ResponseCodes.OK) {
      // @ts-ignore
      entry_page_data = result.data
    } else {
      goto(href);
    }
  }
</script>


{#if entries.size}
  {#if !view}
    {#each entries as [id, entry] (id)}
      <ListEntry
        dictionary={$dictionary}
        {entry}
        videoAccess={$dictionary.videoAccess}
        can_edit={$can_edit}
        on_click={(e) => {handle_entry_click(e, entry)}}
        {dbOperations} />
    {/each}
  {:else if view === 'table'}
    <EntriesTable
      entries={Array.from(entries.values())}
      preferred_table_columns={$preferred_table_columns}
      dictionary={$dictionary}
      can_edit={$can_edit}
      {dbOperations} />
  {:else if view === 'print'}
    Print view still coming
  {:else if view === 'gallery'}
    Gallery view still coming
  {/if}
{/if}

{#if $page.state.entry_id}
  <Modal noscroll class="sm:max-w-95vw xl:max-w-1100px" on:close={() => history.back()}>
    <EntryPage
      data={{
        ...entry_page_data,
        shallow: true,
      }} />
  </Modal>
{/if}
