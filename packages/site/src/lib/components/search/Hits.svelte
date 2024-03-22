<script lang="ts">
  import { onMount, beforeUpdate } from 'svelte';
  import { connectHits } from 'instantsearch.js/es/connectors';
  import type { InstantSearch } from 'instantsearch.js';
  import type { LDAlgoliaHit } from '@living-dictionaries/types';

  export let search: InstantSearch;
  export let on_updated: () => void = undefined

  let hits: LDAlgoliaHit[] = [];

  onMount(() => {
    const customHits = connectHits((params) => {
      hits = params.hits.map((hit) => {
        return { ...hit, id: hit.objectID };
      }) as unknown as LDAlgoliaHit[];
    });

    search.addWidgets([customHits({})]);
  });

  beforeUpdate(() => {
    if (hits.length && on_updated)
      on_updated();
  })
</script>

<slot entries={hits}>Loading...</slot>
