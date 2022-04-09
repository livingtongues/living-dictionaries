<script lang="ts">
  import type { InstantSearch } from 'instantsearch.js';
  import { connectSortBy } from 'instantsearch.js/es/connectors';
  import type { SortByItem } from 'instantsearch.js/es/connectors/sort-by/connectSortBy';
  import { onMount } from 'svelte';

  export let search: InstantSearch;
  let options: SortByItem[] = [];
  let currentRefinement: string;
  let hasNoResults = false;
  let refine: (arg0: string) => any;

  onMount(() => {
    const customSortBy = connectSortBy((params) => {
      ({ options, currentRefinement, hasNoResults, refine } = params);
    });

    search.addWidgets([
      customSortBy({
        items: [
          { label: 'Featured', value: 'instant_search' },
          { label: 'Price (asc)', value: 'instant_search_price_asc' },
          { label: 'Price (desc)', value: 'instant_search_price_desc' },
        ],
      }),
    ]);
  });

  function select(event: Event) {
    refine((event.target as HTMLInputElement).value);
  }
</script>

<!-- svelte-ignore a11y-no-onchange -->
{#if !hasNoResults}
  <select value={currentRefinement} on:change={select}>
    {#each options as option}
      <option value={option.value}>{option.label}</option>
    {/each}
  </select>
{/if}
