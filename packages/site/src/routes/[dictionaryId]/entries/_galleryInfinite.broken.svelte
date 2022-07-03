<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { getContext } from 'svelte';
  import type { InstantSearch } from 'instantsearch.js';
  const search: InstantSearch = getContext('search');

  import InfiniteHits from '$lib/components/search/InfiniteHits.svelte';
  // import IntersectionObserver from '$lib/components/ui/IntersectionObserver.svelte';

  import { connectToggleRefinement } from 'instantsearch.js/es/connectors';
  import { configure } from 'instantsearch.js/es/widgets/index.js';
  import { onMount, onDestroy } from 'svelte';

  let refine: (value?: { isRefined: boolean }) => void;
  onMount(() => {
    const customToggleRefinement = connectToggleRefinement((params) => {
      ({ refine } = params);
    });

    search.addWidgets([
      customToggleRefinement({
        attribute: 'hasImage',
      }),
      configure({
        hitsPerPage: 10,
        page: 1,
      }),
    ]);

    refine({ isRefined: false });
  });

  onDestroy(() => {
    // search.addWidgets([
    //   configure({
    //     page: 1,
    //   }),
    // ]);
    refine({ isRefined: true });
  });

  import { Image } from '@living-dictionaries/parts';
  import { canEdit } from '$lib/stores';
  import type { IEntry } from '@living-dictionaries/types';
  let hitsType: IEntry;
</script>

<InfiniteHits {hitsType} {search} let:hits={entries} let:showMore let:isLastPage>
  {entries}
  <div class="grid">
    {#each entries as entry}
      {#await import('svelte-pieces/data/JSON.svelte') then { default: JSON }}
        <JSON obj={entry} />
      {/await}
      {#if entry.pf}
        <div
          class="bg-gray-300 shadow relative rounded overflow-hidden"
          style="max-width: 500px; max-height: 500px;">
          <Image square={480} lexeme={entry.lx} gcs={entry.pf.gcs} canEdit={$canEdit} />
          <!-- Not catching delete event -->
          <div
            class="text-dark-shadow text-white font-semibold p-2 absolute top-0
              left-0">
            {@html entry._highlightResult.lx.value}
          </div>
          <div
            class="text-dark-shadow text-white p-2 absolute bottom-0 left-0
              text-xs">
            {@html entry._highlightResult.gl.en.value}
          </div>
        </div>
      {/if}
    {:else}&nbsp;{/each}

    {#if !isLastPage}
      <!-- <IntersectionObserver let:intersecting on:intersected={() => showMore()} top={400}>
        {#if intersecting}
          <div class="p-3">
            <i class="far fa-spinner fa-spin" />
            {$_('misc.loading', { default: 'Loading' })}...
          </div>
        {/if}
      </IntersectionObserver> -->
    {/if}
  </div>
</InfiniteHits>

<!-- Talking Dictionaries v1 example: http://talkingdictionary.swarthmore.edu/kapingamarangi/?images&gallery&page=1 -->
<style>
  :global(mark) {
    color: yellow;
    background: rgba(0, 0, 0, 1);
  }

  .grid {
    display: grid;
    gap: 0.5rem;

    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    grid-auto-rows: 1fr;
  }

  /* @media screen and (min-width: 600px) {
    .card-tall {
      grid-row: span 2 / auto;
    }

    .card-wide {
      grid-column: span 2 / auto;
    }
  } */
  .grid::before {
    content: '';
    width: 0;
    padding-bottom: 100%;
    grid-row: 1 / 1;
    grid-column: 1 / 1;
  }

  .grid > *:first-child {
    grid-row: 1 / 1;
    grid-column: 1 / 1;
  }
  /* https://medium.com/cloudaper/how-to-create-a-flexible-square-grid-with-css-grid-layout-ea48baf038f3 */
</style>
