<script lang="ts">
  // import SeoMetaTags from '$lib/components/SeoMetaTags.svelte';
  import { onMount, getContext } from 'svelte';
  import { Doc } from 'sveltefirets';
  import Hits from '$lib/components/search/Hits.svelte';
  import Pagination from '$lib/components/search/Pagination.svelte';
  import EntriesTable from './EntriesTable.svelte';
  import { configure } from 'instantsearch.js/es/widgets/index.js';
  import { convert_and_expand_entry } from '$lib/transformers/convert_and_expand_entry';
  import { writable } from 'svelte/store';
  import type { InstantSearch } from 'instantsearch.js';
  import type { ActualDatabaseEntry, LDAlgoliaHit } from '@living-dictionaries/types';
  import { page } from '$app/stores';

  export let data
  $: ({dictionary, preferred_table_columns, can_edit, dbOperations} = data)

  const search: InstantSearch = getContext('search');

  onMount(() => {
    search.addWidgets([
      configure({
        // @ts-ignore odd error in CI
        hitsPerPage: 35,
      }),
    ]);
  });

  const entries = writable<(ActualDatabaseEntry | LDAlgoliaHit)[]>([]);
</script>

<Hits {search} let:entries={algoliaEntries}>
  <div class="hidden">
    {entries.set(algoliaEntries)}
  </div>

  <EntriesTable
    entries={$entries.map(entry => convert_and_expand_entry(entry, $page.data.t))}
    preferred_table_columns={$preferred_table_columns}
    dictionary={$dictionary}
    can_edit={$can_edit}
    {dbOperations} />

  {#if $can_edit}
    {#each algoliaEntries as algoliaEntry (algoliaEntry.id)}
      <Doc
        path="dictionaries/{$dictionary.id}/words/{algoliaEntry.id}"
        startWith={algoliaEntry}
        on:data={({ detail: { data: entry } }) => {
          const index = $entries.findIndex(({id}) => id === entry.id);
          if (index > -1) $entries[index] = entry;
        }} />
    {/each}
  {/if}
</Hits>
<Pagination {search} />

<!-- <SeoMetaTags
  title={$page.data.t(''})}
  dictionaryName={$dictionary.name}
  description={$page.data.t(''})}
  keywords="Endangered Languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Edit a dictionary, Search a dictionary, Browse a dictionary, Explore a Dictionary" /> -->
