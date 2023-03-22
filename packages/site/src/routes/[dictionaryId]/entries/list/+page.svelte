<script lang="ts">
  // import { _ } from 'svelte-i18n';
  import { getContext } from 'svelte';
  import type { InstantSearch } from 'instantsearch.js';
  const search: InstantSearch = getContext('search');

  import Hits from '$lib/components/search/Hits.svelte';
  import Pagination from '$lib/components/search/Pagination.svelte';

  import { configure } from 'instantsearch.js/es/widgets/index.js';
  import { onMount } from 'svelte';
  onMount(() => {
    search.addWidgets([
      configure({
        hitsPerPage: 30,
      }),
    ]);
  });

  import { dictionary, canEdit, admin } from '$lib/stores';
  import ListEntry from './ListEntry.svelte';
  import { Doc } from 'sveltefirets';
  // import SeoMetaTags from '$lib/components/SeoMetaTags.svelte';
</script>

<Hits {search} let:entries>
  {#if $canEdit}
    {#each entries as algoliaEntry (algoliaEntry.id)}
      <Doc
        path="dictionaries/{$dictionary.id}/words/{algoliaEntry.id}"
        startWith={algoliaEntry}
        let:data={entry}>
        {@const new_entry_shape = entry}
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

<!-- <SeoMetaTags
  title={$_('', { default: 'Entries List' })}
  dictionaryName={$dictionary.name}
  description={$_('', { default: 'The entries in this Living Dictionary are displayed in a comprehensive list that visitors can easily browse by using the page tabs at the bottom of the screen, or search by using the powerful search bar located at the top of the page. Visitors may also filter and display specific content from this Living Dictionary by activating filters for parts of speech, semantic domains, custom tags, speaker information and other metadata.' })}
  keywords="Endangered Languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Edit a dictionary, Search a dictionary, Browse a dictionary, Explore a Dictionary" /> -->
