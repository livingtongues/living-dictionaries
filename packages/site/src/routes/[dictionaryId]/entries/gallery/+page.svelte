<script lang="ts">
  import { getContext } from 'svelte';
  import type { InstantSearch } from 'instantsearch.js';
  const search: InstantSearch = getContext('search');

  import Hits from '$lib/components/search/Hits.svelte';
  import Pagination from '$lib/components/search/Pagination.svelte';

  import { configure } from 'instantsearch.js/es/widgets/index.js';
  import { connectToggleRefinement } from 'instantsearch.js/es/connectors';
  import { onMount } from 'svelte';

  onMount(() => {
    let refine: (value?: { isRefined: boolean }) => void;

    const customToggleRefinement = connectToggleRefinement((params) => {
      ({ refine } = params);
    });

    search.addWidgets([
      customToggleRefinement({
        attribute: 'hasImage',
      }),
      configure({
        hitsPerPage: 20,
        // page: 1,
      }),
    ]);

    refine({ isRefined: false });

    return () => {
      refine({ isRefined: true });
    };
  });

  import { dictionary, canEdit } from '$lib/stores';
  import GalleryEntry from '../_GalleryEntry.svelte';
  import { Doc } from 'sveltefirets';
</script>

<Hits {search} let:entries>
  <div class="grid">
    {#if $canEdit}
      {#each entries as algoliaEntry (algoliaEntry.id)}
        {#if algoliaEntry.pf}
          <Doc
            path="dictionaries/{$dictionary.id}/words/{algoliaEntry.id}"
            startWith={algoliaEntry}
            let:data={entry}>
            <GalleryEntry {entry} canEdit={$canEdit} />
          </Doc>
        {/if}
      {/each}
    {:else}
      {#each entries as entry (entry.id)}
        {#if entry.pf}
          <GalleryEntry {entry} />
        {/if}
      {/each}
    {/if}
  </div>
</Hits>
<Pagination {search} />

<!-- Talking Dictionaries v1 example: http://talkingdictionary.swarthmore.edu/kapingamarangi/?images&gallery&page=1 -->
<style>
  :global(mark) {
    color: yellow;
    background: rgba(0, 0, 0, 1);
  }

  .grid {
    display: grid;
    gap: 0.5rem;

    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    grid-auto-rows: 1fr;
  }
</style>
