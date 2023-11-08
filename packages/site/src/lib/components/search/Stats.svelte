<script lang="ts">
  import { page } from '$app/stores';
  import type { InstantSearch } from 'instantsearch.js';
  import { connectStats } from 'instantsearch.js/es/connectors';
  import { onMount } from 'svelte';

  export let search: InstantSearch;
  let processingTimeMS: number;
  let nbHits = 0;

  onMount(() => {
    const customStats = connectStats((params) => {
      ({ processingTimeMS, nbHits } = params);
    });

    search.addWidgets([customStats({})]);
  });
</script>

<div class="print:hidden italic text-xs text-gray-500 mb-1">
  {$page.data.t('dictionary.entries')}:
  {nbHits}
  {#if nbHits}({processingTimeMS}ms){/if}
</div>
