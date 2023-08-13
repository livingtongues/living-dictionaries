<script lang="ts">
  // import { t } from 'svelte-i18n';
  // import SeoMetaTags from '$lib/components/SeoMetaTags.svelte';
  import { onMount, getContext } from 'svelte';
  import { Doc } from 'sveltefirets';
  import { dictionary, canEdit, admin } from '$lib/stores';
  import ListEntry from './ListEntry.svelte';
  import { convert_and_expand_entry } from '$lib/transformers/convert_and_expand_entry';
  import Hits from '$lib/components/search/Hits.svelte';
  import Pagination from '$lib/components/search/Pagination.svelte';
  import { configure } from 'instantsearch.js/es/widgets/index.js';
  import { deleteImage } from '$lib/helpers/delete';
  import type { InstantSearch } from 'instantsearch.js';
  import { saveUpdateToFirestore } from '$lib/helpers/entry/update';

  const search: InstantSearch = getContext('search');

  onMount(() => {
    search.addWidgets([
      configure({
        // @ts-ignore odd error in CI
        hitsPerPage: 30,
      }),
    ]);
  });
</script>

<Hits {search} let:entries>
  {#if $canEdit}
    {#each entries as algoliaEntry (algoliaEntry.id)}
      <Doc
        path="dictionaries/{$dictionary.id}/words/{algoliaEntry.id}"
        startWith={algoliaEntry}
        let:data={entry}>
        <ListEntry
          dictionary={$dictionary}
          entry={convert_and_expand_entry(entry)}
          videoAccess={$dictionary.videoAccess || $admin > 0}
          canEdit={$canEdit}
          on:deleteImage={() => deleteImage(entry, $dictionary.id)}
          on:valueupdate={({detail: { field, newValue}}) => saveUpdateToFirestore({field, value: newValue, entryId: entry.id, dictionaryId: $dictionary.id})} />
      </Doc>
    {/each}
  {:else}
    {#each entries as entry (entry.id)}
      <ListEntry dictionary={$dictionary} entry={convert_and_expand_entry(entry)} />
    {/each}
  {/if}
</Hits>
<Pagination {search} />

<!-- <SeoMetaTags
  title={$t('', { default: 'Entries List' })}
  dictionaryName={$dictionary.name}
  description={$t('', { default: 'The entries in this Living Dictionary are displayed in a comprehensive list that visitors can easily browse by using the page tabs at the bottom of the screen, or search by using the powerful search bar located at the top of the page.' })}
  keywords="Endangered Languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Edit a dictionary, Search a dictionary, Browse a dictionary, Explore a Dictionary" /> -->
