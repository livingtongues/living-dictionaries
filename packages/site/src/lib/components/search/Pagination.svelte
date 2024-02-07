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

<nav class="sticky md:bottom-0 bg-white pt-2 pb-1 flex items-center print:hidden">
  <PaginationButtons pages={nbPages} current_page={currentRefinement + 1} {go_to_page} />

  {#if $canEdit && showAdd}
    <span class="px-3 md:px-0 fixed md:sticky bottom-3 ltr:right-0 rtl:left-0 z-10">
      {#await import('./AddEntry.svelte') then { default: AddEntry }}
        <AddEntry />
      {/await}
    </span>
  {/if}
</nav>
