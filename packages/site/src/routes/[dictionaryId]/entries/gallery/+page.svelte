<script lang="ts">
  // import SeoMetaTags from '$lib/components/SeoMetaTags.svelte';
  import { onMount, getContext, onDestroy, tick } from 'svelte';
  import Hits from '$lib/components/search/Hits.svelte';
  import Pagination from '$lib/components/search/Pagination.svelte';
  import { configure } from 'instantsearch.js/es/widgets/index.js';
  import { connectToggleRefinement } from 'instantsearch.js/es/connectors';
  import { dictionary_deprecated as dictionary, canEdit } from '$lib/stores';
  import GalleryEntry from './GalleryEntry.svelte';
  import { Doc } from 'sveltefirets';
  import { convert_and_expand_entry } from '$lib/transformers/convert_and_expand_entry';
  import type { InstantSearch } from 'instantsearch.js';
  import { page } from '$app/stores';
  import { lastEntriesUrl } from '$lib/stores/lastEntriesUrl';
  import { sliceUrl, getScrollPointFromLocalStorage } from '$lib/helpers/scrollPoint';

  const search: InstantSearch = getContext('search');
  let lastScrollPoint = 0;

  onMount(() => {
    let refine: (value?: { isRefined: boolean }) => void;

    const customToggleRefinement = connectToggleRefinement((params) => {
      ({ refine } = params);
    });

    search.addWidgets([
      customToggleRefinement({
        attribute: 'hasImage',
      }),
      configure({
        // @ts-ignore odd error in CI
        hitsPerPage: 20,
      }),
    ]);

    lastScrollPoint = sliceUrl($lastEntriesUrl) === `/${$dictionary.id}/entry` ? getScrollPointFromLocalStorage('gallery_scroll_point') : 0;
    refine({ isRefined: false });

    return () => {
      refine({ isRefined: true });
    };
  });

  async function handleMounted() {
    await tick();
    window.scrollTo({top: lastScrollPoint});
  }

  onDestroy(() => {
    localStorage.setItem('gallery_scroll_point', JSON.stringify(lastScrollPoint))
  });
</script>

<svelte:window on:scroll={() => lastScrollPoint = window.scrollY} />

<Hits {search} let:entries>
  <div class="gallery">
    {#if $canEdit}
      {#each entries as algoliaEntry (algoliaEntry.id)}
        {#if algoliaEntry.pf}
          <Doc
            on:ref={handleMounted}
            path="dictionaries/{$dictionary.id}/words/{algoliaEntry.id}"
            startWith={algoliaEntry}
            let:data={entry}>
            <GalleryEntry dictionary={$dictionary} entry={convert_and_expand_entry(entry, $page.data.t)} canEdit={$canEdit} />
          </Doc>
        {/if}
      {/each}
    {:else}
      {#each entries as entry (entry.id)}
        {#if entry.pf}
          <GalleryEntry dictionary={$dictionary} entry={convert_and_expand_entry(entry, $page.data.t)} />
        {/if}
      {/each}
    {/if}
  </div>
</Hits>
<Pagination {search} />

<!-- <SeoMetaTags
  title={$page.data.t(''})}
  dictionaryName={$dictionary.name}
  description={$page.data.t(''})}
  keywords="Endangered Languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Visual, Gallery, Images" /> -->

<!-- Talking Dictionaries v1 example: http://talkingdictionary.swarthmore.edu/kapingamarangi/?images&gallery&page=1 -->
<style>
  :global(mark) {
    color: yellow;
    background: rgba(0, 0, 0, 1);
  }

  .gallery {
    display: grid;
    gap: 0.5rem;

    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    grid-auto-rows: 1fr;
  }
</style>
