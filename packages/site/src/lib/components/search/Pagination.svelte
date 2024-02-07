<script lang="ts">
  import type { InstantSearch } from 'instantsearch.js';
  import { connectPagination } from 'instantsearch.js/es/connectors';
  import { onMount } from 'svelte';
  import { canEdit } from '$lib/stores';
  import PaginationButtons from './PaginationButtons.svelte';

  export let search: InstantSearch;
  export let showAdd = true;
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

{#if $canEdit && showAdd}
  {#await import('./AddEntry.svelte') then { default: AddEntry }}
    <AddEntry class="sticky bottom-3 z-10 md:hidden" />
  {/await}
{/if}

<nav class="md:sticky md:bottom-0 bg-white pt-2 pb-1 flex items-center print:hidden">
  <PaginationButtons pages={nbPages} current_page={currentRefinement + 1} {go_to_page}>
    {#if $canEdit && showAdd}
      {#await import('./AddEntry.svelte') then { default: AddEntry }}
        <AddEntry class="ml-3 hidden md:block" />
      {/await}
    {/if}
  </PaginationButtons>
</nav>
