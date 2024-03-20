<script lang="ts">
  import { getContext } from 'svelte';
  import ListEntry from '../../entries/list/ListEntry.svelte';
  import { readable, type Writable } from 'svelte/store';
  import type { ExpandedEntry } from '@living-dictionaries/types';
  import { page } from '$app/stores';
  import { Modal } from 'svelte-pieces';
  import { pushState } from '$app/navigation';
  import EntryPage from '../../entry/[entryId]/+page.svelte';

  export let data;
  $: ({dictionary, can_edit, dbOperations } = data)

  const entries = getContext<Writable<ExpandedEntry[]>>('entries')
</script>

{#if $entries}
  {#each $entries as entry}
    <ListEntry
      dictionary={$dictionary}
      {entry}
      videoAccess={$dictionary.videoAccess}
      can_edit={$can_edit}
      on_click={async (e) => {
        // bail if opening a new tab or small screen
        if (e.metaKey || e.ctrlKey || window.innerWidth < 640) return;

        // prevent navigation
        e.preventDefault();

        const { href } = e.currentTarget;
        const { search, hash } = window.location
        pushState(`${href}${search}${hash}`, { entry });
      }}
      {dbOperations} />
  {/each}
{/if}

{#if $page.state.entry}
  <Modal noscroll class="sm:max-w-95vw xl:max-w-1100px" on:close={() => history.back()}>
    <EntryPage
      data={{
        ...data,
        entry: readable($page.state.entry),
        actualEntry: null,
        supaEntry: null,
        shallow: true,
      }} />
  </Modal>
{/if}
