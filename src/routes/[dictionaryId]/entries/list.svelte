<script lang="ts">
  import { getContext } from 'svelte';
  import type { InstantSearch } from 'instantsearch.js';
  const search: InstantSearch = getContext('search');

  import Hits from '$lib/components/search/Hits.svelte';
  import Pagination from '$lib/components/search/Pagination.svelte';

  // import { configure } from 'instantsearch.js/es/widgets/index.js';
  import { configure } from 'instantsearch.js/cjs/widgets/index.js';
  import { onMount } from 'svelte';
  onMount(() => {
    search.addWidgets([
      configure({
        hitsPerPage: 30,
      }),
    ]);
  });

  import { dictionary } from '$lib/stores';
  import { canEdit } from '$lib/stores';
  import ListEntry from './_ListEntry.svelte';
  import Doc from '$sveltefire/components/Doc.svelte';
</script>

<svelte:head>
  <title>{$dictionary.name}</title>
</svelte:head>

<Hits {search} let:entries>
  {#if $canEdit}
    <!-- {#await import('$sveltefire/components/Doc.svelte') then { default: Doc }} -->
    {#each entries as algoliaEntry (algoliaEntry.id)}
      <Doc
        path="dictionaries/{$dictionary.id}/words/{algoliaEntry.id}"
        startWith={algoliaEntry}
        let:data={entry}>
        <ListEntry {entry} canEdit={$canEdit} />
      </Doc>
    {/each}
    <!-- {/await} -->
  {:else}
    {#each entries as algoliaEntry (algoliaEntry.id)}
      <ListEntry entry={algoliaEntry} />
    {/each}
  {/if}
</Hits>
<Pagination {search} />
