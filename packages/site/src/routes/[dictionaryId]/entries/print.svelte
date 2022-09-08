<script lang="ts">
  import { getContext } from 'svelte';
  import type { InstantSearch } from 'instantsearch.js';
  const search: InstantSearch = getContext('search');

  import Hits from '$lib/components/search/Hits.svelte';
  import Pagination from '$lib/components/search/Pagination.svelte';

  import { configure } from 'instantsearch.js/es/widgets/index.js';
  import { onMount } from 'svelte';
  onMount(() => {
    search.addWidgets([
      configure({
        hitsPerPage: 300,
      }),
    ]);
  });

  import { dictionary } from '$lib/stores';

  let columnWidth = 250;
  $: columnWidthEm = columnWidth / 16;
</script>

<svelte:head>
  <title>{$dictionary.name}</title>
</svelte:head>

<Hits {search} let:entries>
  <div class="print:hidden">
    <input type="range" min="150" max="800" bind:value={columnWidth} />
    <div
      class="bg-red-50 p-1 border-red-400 border-t border-l border-r overflow-hidden"
      style="width: {columnWidthEm}em">
      Minimum column width: {columnWidth}px
    </div>
  </div>
  <div class="print-columns" style="--column-width: {columnWidthEm}em;">
    {#each entries as entry (entry.id)}
      <div>{entry.lx}</div>
      <div class="italic text-sm mb-1 ml-1">{entry.gl?.en}</div>
    {/each}
  </div>
</Hits>
<Pagination {search} />

<style global>
  @media print {
    .print-columns {
      column-width: var(--column-width);
      /* column-gap: 2em; << default is 1em */
      /* column-count: 2; << hard-coded columns method, not using */
    }
  }
</style>
