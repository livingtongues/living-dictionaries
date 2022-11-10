<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { InstantSearch } from 'instantsearch.js';
  import { connectStats } from 'instantsearch.js/es/connectors';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

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
  {$_('dictionary.entries', { default: 'Entries' })}:
  {nbHits}
  {#if nbHits}({processingTimeMS}ms){/if}
</div>

{#if browser && nbHits === 0}
  <div class="bg-yellow-200 border border-yellow-300 rounded p-3 my-2">
    Our search is not working at the moment. We are working to resolve the issue as soon as possible.
  </div>
{/if}
