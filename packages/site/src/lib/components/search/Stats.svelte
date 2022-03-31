<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { InstantSearch } from 'instantsearch.js';
  // import { connectStats } from 'instantsearch.js/es/connectors';
  import { connectStats } from 'instantsearch.js/cjs/connectors/index.js';
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

{$_('dictionary.entries', { default: 'Entries' })}:
{nbHits}
{#if nbHits}({processingTimeMS}ms){/if}
