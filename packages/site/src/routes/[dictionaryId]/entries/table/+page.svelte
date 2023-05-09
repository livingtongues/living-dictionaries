<script lang="ts">
  // import { t } from 'svelte-i18n';
  // import SeoMetaTags from '$lib/components/SeoMetaTags.svelte';
  import { getContext } from 'svelte';
  import { Doc } from 'sveltefirets';
  import { canEdit, columns, dictionary } from '$lib/stores';
  import Hits from '$lib/components/search/Hits.svelte';
  import Pagination from '$lib/components/search/Pagination.svelte';
  import EntriesTable from '$lib/components/table/EntriesTable.svelte';
  import { configure } from 'instantsearch.js/es/widgets/index.js';
  import { onMount } from 'svelte';
  import { convert_and_expand_entry } from '$lib/transformers/convert_and_expand_entry';
  import { writable } from 'svelte/store';
  import type { InstantSearch } from 'instantsearch.js';
  import type { ActualDatabaseEntry, LDAlgoliaHit } from '@living-dictionaries/types';

  const search: InstantSearch = getContext('search');

  onMount(() => {
    search.addWidgets([
      configure({
        hitsPerPage: 35,
      }),
    ]);
  });

  $: adjustedColumns = ['babanki', 'torwali'].includes($dictionary.id)
    ? [...$columns, { field: 'va', width: 150 }]
    : $columns;

  let entries = writable<(ActualDatabaseEntry | LDAlgoliaHit)[]>([]);
</script>

<Hits {search} let:entries={algoliaEntries}>
  <div class="hidden">
    {entries.set(algoliaEntries)}
  </div>

  <EntriesTable
    entries={$entries.map(convert_and_expand_entry)}
    columns={adjustedColumns}
    canEdit={$canEdit} />

  {#if $canEdit}
    {#each algoliaEntries as algoliaEntry (algoliaEntry.id)}
      <Doc
        path="dictionaries/{$dictionary.id}/words/{algoliaEntry.id}"
        startWith={algoliaEntry}
        on:data={({ detail: { data: entry } }) => {
          const index = $entries.findIndex((e) => e.id === entry.id);
          if (index > -1) $entries[index] = entry;
        }} />
    {/each}
  {/if}
</Hits>
<Pagination {search} />

<!-- <SeoMetaTags 
  title={$t('', { default: 'Entries Table' })}
  dictionaryName={$dictionary.name}
  description={$t('', { default: 'The entries in this Living Dictionary are displayed in a comprehensive table (spreadsheet) that visitors can easily browse by using the page tabs at the bottom of the screen, or search by using the powerful search bar located at the top of the page. Visitors may also filter and display specific content from this Living Dictionary by activating filters for parts of speech, semantic domains, custom tags, speaker information and other metadata.' })}
  keywords="Endangered Languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Edit a dictionary, Search a dictionary, Browse a dictionary, Explore a Dictionary" /> -->
