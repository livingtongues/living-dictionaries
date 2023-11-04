<script lang="ts">
  // import SeoMetaTags from '$lib/components/SeoMetaTags.svelte';
  import { onMount, getContext } from 'svelte';
  import { Doc } from 'sveltefirets';
  import { canEdit, preferredColumns, dictionary } from '$lib/stores';
  import Hits from '$lib/components/search/Hits.svelte';
  import Pagination from '$lib/components/search/Pagination.svelte';
  import EntriesTable from './EntriesTable.svelte';
  import { configure } from 'instantsearch.js/es/widgets/index.js';
  import { convert_and_expand_entry } from '$lib/transformers/convert_and_expand_entry';
  import { writable } from 'svelte/store';
  import type { InstantSearch } from 'instantsearch.js';
  import type { ActualDatabaseEntry, LDAlgoliaHit } from '@living-dictionaries/types';
  import { deleteImage } from '$lib/helpers/delete';
  import { saveUpdateToFirestore } from '$lib/helpers/entry/update';
  import { setUpColumns } from './setUpColumns';

  const search: InstantSearch = getContext('search');

  onMount(() => {
    search.addWidgets([
      configure({
        // @ts-ignore odd error in CI
        hitsPerPage: 35,
      }),
    ]);
  });

  $: columns = setUpColumns($preferredColumns, $dictionary);
  const entries = writable<(ActualDatabaseEntry | LDAlgoliaHit)[]>([]);
</script>

<Hits {search} let:entries={algoliaEntries}>
  <div class="hidden">
    {entries.set(algoliaEntries)}
  </div>

  <EntriesTable
    entries={$entries.map(convert_and_expand_entry)}
    {columns}
    dictionaryId={$dictionary.id}
    canEdit={$canEdit}
    on:deleteImage={({detail: {entryId}}) => deleteImage({id: entryId}, $dictionary.id)}
    on:valueupdate={({detail: { field, newValue, entryId }}) => saveUpdateToFirestore({field, value: newValue, entryId, dictionaryId: $dictionary.id})} />

  {#if $canEdit}
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
  title={$t('', { default: 'Entries Table' })}
  dictionaryName={$dictionary.name}
  description={$t('', { default: 'The entries in this Living Dictionary are displayed in a comprehensive table (spreadsheet) that visitors can easily browse by using the page tabs at the bottom of the screen, or search by using the powerful search bar located at the top of the page.' })}
  keywords="Endangered Languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Edit a dictionary, Search a dictionary, Browse a dictionary, Explore a Dictionary" /> -->
