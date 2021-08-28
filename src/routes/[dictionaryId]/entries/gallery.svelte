<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { getContext } from 'svelte';
  import type { InstantSearch } from 'instantsearch.js';
  const search: InstantSearch = getContext('search');

  import Hits from '$lib/components/search/Hits.svelte';
  import Pagination from '$lib/components/search/Pagination.svelte';

  // import { connectToggleRefinement } from 'instantsearch.js/es/connectors';
  import { connectToggleRefinement } from 'instantsearch.js/cjs/connectors/index.js';
  import { onMount, onDestroy } from 'svelte';
  import EntriesGallery from './_EntriesGallery.svelte';

  let refine: (arg0: any) => any;
  onMount(() => {
    const customToggleRefinement = connectToggleRefinement((params) => {
      ({ refine } = params);
    });

    search.addWidgets([
      customToggleRefinement({
        attribute: 'hasImage',
      }),
      // configure({
      //   hitsPerPage: 10,
      //   page: 1,
      // }),
    ]);

    refine({ isRefined: false });
  });

  onDestroy(() => {
    // search.addWidgets([
    //   configure({
    //     page: 1,
    //   }),
    // ]);
    refine({ isRefined: true });
  });
</script>

<Hits {search} let:entries>
  <EntriesGallery {entries} />
</Hits>
<Pagination {search} />
