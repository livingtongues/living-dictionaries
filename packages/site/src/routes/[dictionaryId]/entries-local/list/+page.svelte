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
  import { convert_and_expand_entry } from '$lib/transformers/convert_and_expand_entry';

  export let data;
  $: ({dictionary, can_edit, dbOperations, edited_entries } = data)

  const entries = getContext<Writable<ExpandedEntry[]>>('entries')
  // $: if ($edited_entries?.length)
  //   update_index_entries($edited_entries)

  let entry_page_data: EntryPageData

  async function handle_entry_click(e: MouseEvent & { currentTarget: EventTarget & HTMLAnchorElement }, entry: ExpandedEntry) {
    // bail if opening a new tab // or small screen  || window.innerWidth < 640
    if (e.metaKey || e.ctrlKey) return;
    e.preventDefault(); // prevent navigation

    // @ts-expect-error
    console.info({opened: entry, lexeme_other: entry.lexeme_other?.join(', ')})

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
    {@const updated_entry = $edited_entries?.find(({id}) => id === entry.id)}
    {@const expanded_entry = updated_entry && convert_and_expand_entry(updated_entry, $page.data.t)}
    <ListEntry
      dictionary={$dictionary}
      entry={expanded_entry || entry}
      videoAccess={$dictionary.videoAccess}
      can_edit={$can_edit}
      on_click={(e) => {handle_entry_click(e, entry)}}
      {dbOperations} />
  {/each}

  <!-- Gallery view -->
  <!-- Table view -->
  <!-- Print view -->
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
