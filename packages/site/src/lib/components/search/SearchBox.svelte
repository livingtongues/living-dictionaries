<script lang="ts">
  import { page } from '$app/stores';
  import type { InstantSearch } from 'instantsearch.js';
  import { connectSearchBox } from 'instantsearch.js/es/connectors';
  import { onMount, createEventDispatcher } from 'svelte';

  export let search: InstantSearch;

  let query = null;
  let isSearchStalled = false;

  let refine: (arg0: string) => any = (_query?) => {}; // stub function until received from instantsearch;

  onMount(() => {
    const customSearchBox = connectSearchBox((params) => {
      ({ refine, isSearchStalled } = params);
      const { query: currentQuery } = params;
      if (query === null)
        query = currentQuery;

    });

    search.addWidgets([customSearchBox({})]);
  });

  const dispatch = createEventDispatcher<{showFilterMenu: boolean}>();
</script>

<div class="flex flex-grow rounded-md shadow-sm">
  <div class="relative flex-grow focus-within:z-10">
    <div
      class="absolute inset-y-0 left-0 pl-3 flex items-center
        pointer-events-none">
      <i class="far {isSearchStalled ? 'fa-spinner fa-spin' : 'fa-search'} text-gray-500" />
    </div>
    <input
      type="search"
      bind:value={query}
      on:input={(e) => {
        //@ts-ignore
        refine(e.target.value);
      }}
      placeholder={$page.data.t('entry.search_entries')}
      class="form-input text-sm w-full pl-10 pr-3 py-2 rounded-none ltr:!rounded-l-md rtl:!rounded-r-md md:!rounded-r-md md:!rounded-l-md" />
  </div>
  <button
    type="button"
    on:click={() => dispatch('showFilterMenu')}
    class="-ml-px relative flex items-center px-3 py-2 ltr:rounded-r-md rtl:rounded-l-md border
      border-gray-300 text-sm leading-5 bg-gray-50 text-gray-900
      focus:border-blue-300
      focus:z-10 transition ease-in-out duration-150 md:hidden">
    <i class="far fa-filter text-gray-400" />
    <span class="ml-2 hidden sm:inline">
      {$page.data.t('entry.filters')}
    </span>
  </button>
</div>
