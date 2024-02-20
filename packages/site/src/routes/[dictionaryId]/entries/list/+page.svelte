<script lang="ts">
  // import SeoMetaTags from '$lib/components/SeoMetaTags.svelte';
  import { onMount, getContext, onDestroy, tick } from 'svelte';
  import { Doc } from 'sveltefirets';
  import { dictionary_deprecated as dictionary, canEdit, admin } from '$lib/stores';
  import ListEntry from './ListEntry.svelte';
  import { convert_and_expand_entry } from '$lib/transformers/convert_and_expand_entry';
  import Hits from '$lib/components/search/Hits.svelte';
  import Pagination from '$lib/components/search/Pagination.svelte';
  import { configure } from 'instantsearch.js/es/widgets/index.js';
  import { deleteImage } from '$lib/helpers/delete';
  import type { InstantSearch } from 'instantsearch.js';
  import { updateFirestoreEntry } from '$lib/helpers/entry/update';
  import { page } from '$app/stores';

  const search: InstantSearch = getContext('search');
  let lastScrollPoint = 0;

  onMount(() => {
    search.addWidgets([
      configure({
        // @ts-ignore odd error in CI
        hitsPerPage: 30,
      }),
    ]);
    lastScrollPoint = parseInt(localStorage.getItem('list_scroll_point')) || 0;
  });

  async function handleMounted() {
    await tick();
    window.scrollTo({top: lastScrollPoint});
  }

  onDestroy(() => {
    localStorage.setItem('list_scroll_point', JSON.stringify(lastScrollPoint))
  });
</script>

<svelte:window on:scroll={() => lastScrollPoint = window.scrollY} />

<Hits {search} let:entries>
  {#if $canEdit}
    {#each entries as algoliaEntry (algoliaEntry.id)}
      <Doc
        on:ref={handleMounted}
        path="dictionaries/{$dictionary.id}/words/{algoliaEntry.id}"
        startWith={algoliaEntry}
        let:data={entry}>
        <ListEntry
          dictionary={$dictionary}
          entry={convert_and_expand_entry(entry, $page.data.t)}
          videoAccess={$dictionary.videoAccess || $admin > 0}
          canEdit={$canEdit}
          on:deleteImage={() => deleteImage(entry, $dictionary.id)}
          on:valueupdate={({detail: { field, newValue}}) => updateFirestoreEntry({field, value: newValue, entryId: entry.id})} />
      </Doc>
    {/each}
  {:else}
    {#each entries as entry (entry.id)}
      <ListEntry dictionary={$dictionary} entry={convert_and_expand_entry(entry, $page.data.t)} />
    {/each}
  {/if}
</Hits>
<Pagination {search} />

<!-- <SeoMetaTags
  title={$page.data.t(''})}
  dictionaryName={$dictionary.name}
  description={$page.data.t(''})}
  keywords="Endangered Languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Edit a dictionary, Search a dictionary, Browse a dictionary, Explore a Dictionary" /> -->
