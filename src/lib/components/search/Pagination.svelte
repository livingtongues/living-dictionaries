<script lang="ts">
  import type { InstantSearch } from 'instantsearch.js';
  // import { connectPagination } from 'instantsearch.js/es/connectors';
  import { connectPagination } from 'instantsearch.js/cjs/connectors/index.js';
  import { onMount } from 'svelte';
  import { isManager, isContributor, dictionary } from '$lib/stores';
  import { _ } from 'svelte-i18n';
  import Button from '$svelteui/ui/Button.svelte';

  export let search: InstantSearch;
  let pages: number[] = [];
  let currentRefinement: number;
  let nbPages: number;
  let isFirstPage: boolean;
  let isLastPage: boolean;
  let refine: (page: number) => void;

  onMount(() => {
    const customPagination = connectPagination((params) => {
      ({ pages, currentRefinement, nbPages, isFirstPage, isLastPage, refine } = params);
    });

    search.addWidgets([customPagination({})]);
  });
</script>

<nav class="sticky md:bottom-0 bg-white pt-2 pb-1 flex items-center">
  {#if !isFirstPage}
    <button
      type="button"
      on:click={() => {
        refine(0);
        window.scrollTo({ top: 0 });
      }}
      class="hidden sm:block rounded py-2 px-3 mr-1 text-sm leading-5 font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:text-gray-800 focus:outline-none transition ease-in-out duration-150">
      <i class="far fa-angle-double-left rtl-x-flip" /></button>
    <button
      type="button"
      on:click={() => {
        refine(currentRefinement - 1);
        window.scrollTo({ top: 0 });
      }}
      class="rounded py-2 px-3 mr-1 sm:text-sm leading-5 font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:text-gray-800 focus:outline-none transition ease-in-out duration-150">
      <i class="far fa-angle-left rtl-x-flip">
        <!-- <span class="sm:hidden ml-1">Previous</span> -->
      </i></button>
  {/if}

  <div class="hidden md:flex">
    {#each pages as page}
      <button
        type="button"
        on:click={() => {
          refine(page);
          window.scrollTo({ top: 0 });
        }}
        class="{currentRefinement === page
          ? 'bg-blue-100 text-blue-700 focus:bg-blue-200 focus:text-blue-800'
          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:text-gray-800'} rounded py-2 px-3 mr-1 inline-flex items-center text-sm leading-5 font-medium focus:outline-none  transition ease-in-out duration-150">
        {page + 1}
      </button>
    {/each}
  </div>

  {#if !isLastPage}
    <button
      type="button"
      on:click={() => {
        refine(currentRefinement + 1);
        window.scrollTo({ top: 0 });
      }}
      class="rounded py-2 px-3 mr-1 sm:text-sm leading-5 font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:text-gray-800 focus:outline-none transition ease-in-out duration-150">
      <!-- <span class="sm:hidden mr-1">Next</span> -->
      <i class="far fa-angle-right rtl-x-flip" /></button>
    <button
      type="button"
      on:click={() => {
        refine(nbPages - 1);
        window.scrollTo({ top: 0 });
      }}
      class="hidden sm:block rounded py-2 px-3 mr-1 text-sm leading-5 font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:text-gray-800 focus:outline-none transition ease-in-out duration-150">
      <i class="far fa-angle-double-right rtl-x-flip" /></button>
  {/if}

  <div class="flex-grow" />

  {#if $isManager || $isContributor}
    <span class="px-3 md:px-0 fixed md:sticky bottom-3 ltr:right-0 rtl:left-0 z-10">
      <Button href={'/' + $dictionary.id + '/entry/new'} form="primary">
        <i class="far fa-plus" />
        {$_('entry.add_entry', { default: 'Add Entry' })}
      </Button>
    </span>
  {/if}
</nav>
