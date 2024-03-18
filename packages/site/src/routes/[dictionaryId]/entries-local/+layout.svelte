<script lang="ts">
  import { JSON, ShowHide } from 'svelte-pieces';
  import SearchInput from './SearchInput.svelte';
  import { setContext } from 'svelte';
  import type { ExpandedEntry } from '@living-dictionaries/types';
  import { writable } from 'svelte/store';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import Pagination from './Pagination.svelte';
  import EntryFilters from './EntryFilters.svelte';

  export let data;
  $: ({entries, entries_per_page, search_params} = data)

  $: current_page_index = $search_params.page - 1 || 0
  let search_time: string
  let search_results_count: number
  $: number_of_entry_pages = entries_into_pages($entries?.length)
  $: number_of_search_pages = $search_params.query ? entries_into_pages(search_results_count) : null

  function entries_into_pages(count: number) {
    if (!count) return 0
    return Math.ceil(count / entries_per_page)
  }

  const page_entries = writable<ExpandedEntry[]>(null)
  setContext('entries', page_entries)

  $: if (browser && $entries) {
    if (!$search_params.query)
      set_entries_by_page(current_page_index)
    else if ($search_params.query)
      search(current_page_index)
  }

  function set_entries_by_page(page_index: number) {
    console.info({noquery: $search_params.query})
    // if ($search_params.page === 1)
    //   $search_params.page = null
    search_results_count = null
    search_time = null
    page_entries.set($entries.slice(page_index * entries_per_page, (page_index + 1) * entries_per_page))
  }

  async function search(page_index: number) {
    console.info({query: $search_params.query})
    const {elapsed: { formatted }, count, hits} = await entries.search($search_params.query, page_index)
    search_results_count = count
    search_time = formatted
    const entry_hits = hits.map(hit => hit.document) as ExpandedEntry[]
    page_entries.set(entry_hits)
  }
</script>

<ShowHide let:show={show_mobile_filters} let:toggle>
  <div
    class="flex mb-1 items-center sticky top-0 md:top-12 pt-2 md:pt-0 pb-1
      bg-white z-20 print:hidden">
    <SearchInput {search_params} on_show_filter_menu={toggle} />
    <JSON obj={$entries} />
  </div>

  <div class="flex">
    <div class="flex-grow w-0 relative">
      {#if $entries}
        <div class="print:hidden italic text-xs text-gray-500 mb-1">
          {#if typeof search_results_count === 'number'}
            Results: {current_page_index * entries_per_page + 1}-{Math.min((current_page_index + 1) * entries_per_page, search_results_count)} /
            {search_results_count}
            ({search_time.includes('μs') ? '<1ms' : search_time})
          {:else}
            {$page.data.t('dictionary.entries')}:
            {$entries.length}
          {/if}
        </div>
      {/if}
      <slot />
      <Pagination bind:page_from_url={$search_params.page} number_of_pages={number_of_search_pages ?? number_of_entry_pages} />
    </div>
    <div class="hidden md:block w-3 flex-shrink-0 print:hidden" />
    <EntryFilters {show_mobile_filters} on_close={toggle} />
  </div>
</ShowHide>
