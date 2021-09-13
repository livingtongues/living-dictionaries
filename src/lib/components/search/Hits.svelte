<script lang="ts">
  import type { InstantSearch } from 'instantsearch.js';
  export let search: InstantSearch;

  import type { IEntry } from '$lib/interfaces';
  let hits: IEntry[] = [];

  import { onMount } from 'svelte';
  // import { connectHits } from 'instantsearch.js/es/connectors';
  import { connectHits } from 'instantsearch.js/cjs/connectors/index.js';

  onMount(() => {
    const customHits = connectHits((params) => {
      // @ts-ignore
      hits = params.hits.map((hit) => {
        return { ...hit, id: hit.objectID };
      });
    });

    search.addWidgets([customHits({})]);
  });
</script>

<slot entries={hits}>Loading...</slot>
