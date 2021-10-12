<script lang="ts">
  import { getContext } from 'svelte';
  import type { InstantSearch } from 'instantsearch.js';
  const search: InstantSearch = getContext('search');
  import Hits from '$lib/components/search/Hits.svelte';

  import Pagination from '$lib/components/search/Pagination.svelte';
  import EntriesTable from '$lib/components/table/EntriesTable.svelte';

  // import { configure } from 'instantsearch.js/es/widgets/index.js';
  import { configure } from 'instantsearch.js/cjs/widgets/index.js';
  import { onMount } from 'svelte';
  onMount(() => {
    search.addWidgets([
      configure({
        hitsPerPage: 35,
      }),
    ]);
  });
</script>

<Hits {search} let:entries>
  <EntriesTable {entries} />
</Hits>
<Pagination {search} />
