<script lang="ts">
  import { getContext } from 'svelte';
  import ListEntry from '../../entries/list/ListEntry.svelte';
  import { readable, type Writable } from 'svelte/store';
  import type { ExpandedEntry } from '@living-dictionaries/types';
  import { page } from '$app/stores';
  import { Modal } from 'svelte-pieces';
  import { goto, preloadData, pushState } from '$app/navigation';
  import EntryPage from '../../entry/[entryId]/+page.svelte';
  import { ResponseCodes } from '$lib/constants';
  import type { PageData as EntryPageData } from '../../entry/[entryId]/$types';

  export let data;
  $: ({dictionary, can_edit, dbOperations } = data)

  const entries = getContext<Writable<ExpandedEntry[]>>('entries')

  let entry_page_data: EntryPageData

  async function handle_entry_click(e: MouseEvent & { currentTarget: EventTarget & HTMLAnchorElement }, entry: ExpandedEntry) {
    // bail if opening a new tab // or small screen  || window.innerWidth < 640
    if (e.metaKey || e.ctrlKey) return;
    e.preventDefault(); // prevent navigation

    entry_page_data = {
      ...data,
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

{#if $entries}
  {#each $entries as entry}
    <ListEntry
      dictionary={$dictionary}
      {entry}
      videoAccess={$dictionary.videoAccess}
      can_edit={$can_edit}
      on_click={(e) => {handle_entry_click(e, entry)}}
      {dbOperations} />
  {/each}
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
