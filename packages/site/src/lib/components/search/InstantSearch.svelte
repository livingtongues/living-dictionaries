<script lang="ts">
  export let dictionaryId = '';

  // https://github.com/algolia/instantsearch.js/issues/4144
  // import algoliasearch from 'algoliasearch/lite'; /// <reference types="algoliasearch" /> TODO
  import algoliasearch from 'algoliasearch';
  import instantsearch from 'instantsearch.js';
  import { configure } from 'instantsearch.js/es/widgets/index.js';
  import {
    connectSearchBox,
    connectInfiniteHits,
    connectToggleRefinement,
  } from 'instantsearch.js/es/connectors';
  import { algoliaQueryParams } from '$lib/stores';

  const searchClient = algoliasearch(
    'XCVBAYSYXD', // App ID
    'e6d98efb32d3dc2435dce7b97ea87c3e' // Search-Only public API key
  );

  const prodIndex = 'entries_prod';
  // const prodIndex = dictionaryId === 'onondaga' ? 'entries_prod_by_ei' : 'entries_prod';

  const search = instantsearch({
    searchClient,
    indexName: prodIndex, // not presently using dev index because of large dictionaries about to be imported (dev index doubles our Algolia usage)
    // indexName: dev ? 'entries_dev' : prodIndex,
    routing: true, // customize routing https://www.algolia.com/doc/guides/building-search-ui/going-further/routing-urls/js/
    onStateChange({ uiState, setUiState }) {
      setUiState(uiState);
      setTimeout(() => {
        const queryParams = window.location.href.match(/(\?.*)/);
        algoliaQueryParams.set((queryParams && queryParams[0]) || '');
      }, 1000);
    },
  });

  // For resuming from routed state, mount "virtual widgets" that don't render anything until actual widgets are mounted:
  const virtualSearchBox = connectSearchBox(() => null);
  const virtualToggleRefinement = connectToggleRefinement(() => null);
  const virtualInfiniteHits = connectInfiniteHits(() => null);

  search.addWidgets([
    configure({
      hitsPerPage: 30, // adjust lower for mobile
      filters: `dictId:"${dictionaryId}"`,
    }),
    virtualSearchBox({}),
    virtualToggleRefinement({ attribute: 'placeholder' }),
    virtualInfiniteHits({}),
  ]);

  search.start();

  import { setContext } from 'svelte';
  setContext('search', search);
</script>

<slot {search}>Loading...</slot>
