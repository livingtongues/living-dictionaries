<script lang="ts">
  import type { InstantSearch } from 'instantsearch.js';
  import { connectPagination } from 'instantsearch.js/es/connectors';
  import { onMount } from 'svelte';
  import PaginationButtons from './PaginationButtons.svelte';
  import { page } from '$app/stores';
  import type { DbOperations } from '$lib/dbOperations';

  export let search: InstantSearch;
  export let showAdd = true;
  export let addNewEntry: DbOperations['addNewEntry']

  $: ({can_edit} = $page.data)

  let currentRefinement: number;
  let nbPages: number;
  let refine: (page: number) => void;

  onMount(() => {
    const customPagination = connectPagination((params) => {
      ({ currentRefinement, nbPages, refine } = params);
    });

    search.addWidgets([customPagination({})]);
  });

  function go_to_page(one_based_page: number) {
    refine(one_based_page - 1);
    window.scrollTo({ top: 0 });
  }
</script>

{#if $can_edit && showAdd}
  {#await import('./AddEntry.svelte') then { default: AddEntry }}
    <AddEntry {addNewEntry} class="sticky bottom-3 z-10 md:hidden" />
  {/await}
{/if}

<nav class="md:sticky md:bottom-0 bg-white pt-2 pb-1 flex items-center print:hidden">
  <PaginationButtons pages={nbPages} current_page={currentRefinement + 1} {go_to_page}>
    {#if $can_edit && showAdd}
      {#await import('./AddEntry.svelte') then { default: AddEntry }}
        <AddEntry {addNewEntry} class="ml-3 hidden md:block" />
      {/await}
    {/if}
  </PaginationButtons>
</nav>
