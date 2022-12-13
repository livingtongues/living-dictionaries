<script lang="ts">
  // import { _ } from 'svelte-i18n';
  import { getContext } from 'svelte';
  import type { InstantSearch } from 'instantsearch.js';
  const search: InstantSearch = getContext('search');
  import Hits from '$lib/components/search/Hits.svelte';

  import Pagination from '$lib/components/search/Pagination.svelte';
  import EntriesTable from '$lib/components/table/EntriesTable.svelte';
  // import SeoMetaTags from '$lib/components/SeoMetaTags.svelte';

  import { configure } from 'instantsearch.js/es/widgets/index.js';
  import { onMount } from 'svelte';
  // import { dictionary } from '$lib/stores'
  onMount(() => {
    search.addWidgets([
      configure({
        hitsPerPage: 35,
      }),
    ]);
  });
</script>

<!-- <SeoMetaTags 
  title={$_('', { default: 'Entries Table' })}
  dictionaryName={$dictionary.name}
  description={$_('', { default: 'The entries in this Living Dictionary are displayed in a comprehensive table (spreadsheet) that visitors can easily browse by using the page tabs at the bottom of the screen, or search by using the powerful search bar located at the top of the page. Visitors may also filter and display specific content from this Living Dictionary by activating filters for parts of speech, semantic domains, custom tags, speaker information and other metadata.' })}
  keywords="Endangered Languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Edit a dictionary, Search a dictionary, Browse a dictionary, Explore a Dictionary" /> -->

<Hits {search} let:entries>
  <EntriesTable {entries} />
</Hits>
<Pagination {search} />
