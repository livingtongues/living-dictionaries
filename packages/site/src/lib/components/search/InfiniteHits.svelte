<script lang="ts">
  import type { InstantSearch } from 'instantsearch.js';
  // import { connectInfiniteHits } from 'instantsearch.js/es/connectors';
  import { connectInfiniteHits } from 'instantsearch.js/cjs/connectors/index.js';
  import { onMount } from 'svelte';

  // import instantsearch from 'instantsearch.js';
  // const sessionStorageCache =
  // instantsearch.createInfiniteHitsSessionStorageCache();

  type T = $$Generic;
  export let hitsType: T;

  export let search: InstantSearch;
  let hits: T[] = [];
  let showMore: () => void;
  let isLastPage = false;

  onMount(async () => {
    const customInfiniteHits = connectInfiniteHits((params) => {
      //@ts-ignore
      ({ hits, showMore, isLastPage } = params);
      console.log({ hits });
      // showPrevious, // function
      // isFirstPage, // boolean
    });

    search.addWidgets([
      customInfiniteHits({
        // showPrevious: true,
        // cache: sessionStorageCache,
      }),
    ]);
  });
</script>

<slot {hits} {showMore} {isLastPage}>Loading...</slot>

<!-- svelte-ignore empty-block -->
{#if hitsType}{/if}
