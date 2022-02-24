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

  import { dictionary, canEdit, admin } from '$lib/stores';
  import ListEntry from './_ListEntry.svelte';
  import { Doc } from '$sveltefirets';
</script>

<svelte:head>
  <title>{$dictionary.name}</title>
</svelte:head>

<Hits {search} let:entries>
  {#if $canEdit}
    {#each entries as algoliaEntry (algoliaEntry.id)}
      <Doc
        path="dictionaries/{$dictionary.id}/words/{algoliaEntry.id}"
        startWith={algoliaEntry}
        let:data={entry}>
        <ListEntry {entry} videoAccess={$dictionary.videoAccess || $admin > 0} canEdit={$canEdit} />
      </Doc>
    {/each}
  {:else}
    {#each entries as entry (entry.id)}
      <ListEntry {entry} />
    {/each}
  {/if}
</Hits>
<Pagination {search} />
