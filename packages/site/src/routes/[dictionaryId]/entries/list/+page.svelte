<script lang="ts">
  // import SeoMetaTags from '$lib/components/SeoMetaTags.svelte';
  import { onMount, getContext, onDestroy } from 'svelte';
  import { Doc } from 'sveltefirets';
  import { dictionary_deprecated as dictionary, canEdit, admin } from '$lib/stores';
  import ListEntry from './ListEntry.svelte';
  import { convert_and_expand_entry } from '$lib/transformers/convert_and_expand_entry';
  import Hits from '$lib/components/search/Hits.svelte';
  import Pagination from '$lib/components/search/Pagination.svelte';
  import { configure } from 'instantsearch.js/es/widgets/index.js';
  import { deleteImage } from '$lib/helpers/delete';
  import type { InstantSearch } from 'instantsearch.js';
  import { navigating, page } from '$app/stores';
  import { save_scroll_point, restore_scroll_point } from '$lib/helpers/scrollPoint';
  import { browser } from '$app/environment';
  import List from './List.svelte';

  const search: InstantSearch = getContext('search');
  let pixels_from_top = 0;

  onMount(() => {
    search.addWidgets([
      configure({
        // @ts-ignore odd error in CI
        hitsPerPage: 30,
      }),
    ]);
  });

  onDestroy(() => {
    if (!browser || !$navigating?.from?.url) return;
    const { href } = $navigating.from.url;
    save_scroll_point(href, pixels_from_top);
  });
</script>

<svelte:window bind:scrollY={pixels_from_top} />

<Hits {search} let:entries on_updated={restore_scroll_point}>
  {#if $canEdit}
    {#each entries as algoliaEntry (algoliaEntry.id)}
      <Doc
        path="dictionaries/{$dictionary.id}/words/{algoliaEntry.id}"
        startWith={algoliaEntry}
        let:data={entry}>
        <ListEntry
          dictionary={$dictionary}
          entry={convert_and_expand_entry(entry, $page.data.t)}
          videoAccess={$dictionary.videoAccess || $admin > 0}
          canEdit={$canEdit}
          on:deleteImage={() => deleteImage(entry, $dictionary.id)} />
      </Doc>
    {/each}
  {:else}
    <List {entries} dictionary={$dictionary} />
  {/if}
</Hits>
<Pagination {search} />

<!-- <SeoMetaTags
  title={$page.data.t(''})}
  dictionaryName={$dictionary.name}
  description={$page.data.t(''})}
  keywords="Endangered Languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Edit a dictionary, Search a dictionary, Browse a dictionary, Explore a Dictionary" /> -->
