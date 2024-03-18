<script lang="ts">
  // import SeoMetaTags from '$lib/components/SeoMetaTags.svelte';
  import { onMount, getContext, onDestroy } from 'svelte';
  import Hits from '$lib/components/search/Hits.svelte';
  import Pagination from '$lib/components/search/Pagination.svelte';
  import { configure } from 'instantsearch.js/es/widgets/index.js';
  import { connectToggleRefinement } from 'instantsearch.js/es/connectors';
  import GalleryEntry from './GalleryEntry.svelte';
  import { Doc } from 'sveltefirets';
  import { convert_and_expand_entry } from '$lib/transformers/convert_and_expand_entry';
  import type { InstantSearch } from 'instantsearch.js';
  import { navigating, page } from '$app/stores';
  import { save_scroll_point, restore_scroll_point } from '$lib/helpers/scrollPoint';
  import { browser } from '$app/environment';

  const search: InstantSearch = getContext('search');
  let pixels_from_top = 0;

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

    refine({ isRefined: false });

    return () => {
      refine({ isRefined: true });
    };
  });

  onDestroy(() => {
    if (!browser || !$navigating?.from?.url) return;
    const { href } = $navigating.from.url;
    save_scroll_point(href, pixels_from_top);
  });
</script>

<svelte:window bind:scrollY={pixels_from_top} />

<Hits {search} let:entries on_updated={restore_scroll_point}>
  <div class="gallery">
    {#if $page.data.can_edit}
      {#each entries as algoliaEntry (algoliaEntry.id)}
        {#if algoliaEntry.pf}
          <Doc
            path="dictionaries/{$page.data.dictionary.id}/words/{algoliaEntry.id}"
            startWith={algoliaEntry}
            let:data={entry}>
            <GalleryEntry dictionary={$page.data.dictionary} entry={convert_and_expand_entry(entry, $page.data.t)} canEdit={$page.data.can_edit} />
          </Doc>
        {/if}
      {/each}
    {:else}
      {#each entries as entry (entry.id)}
        {#if entry.pf}
          <GalleryEntry dictionary={$page.data.dictionary} entry={convert_and_expand_entry(entry, $page.data.t)} />
        {/if}
      {/each}
    {/if}
  </div>
</Hits>
<Pagination {search} />

<!-- <SeoMetaTags
  title={$page.data.t(''})}
  dictionaryName={$page.data.dictionary.name}
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
