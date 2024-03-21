<script lang="ts">
  import { ShowHide } from 'svelte-pieces';
  import SearchInput from './SearchInput.svelte';
  import { setContext } from 'svelte';
  import type { ExpandedEntry } from '@living-dictionaries/types';
  import { writable } from 'svelte/store';
  import { page } from '$app/stores';
  import Pagination from './Pagination.svelte';
  import EntryFilters from './EntryFilters.svelte';
  import type { FacetResult } from '@orama/orama';
  import type { QueryParams } from '$lib/search/types';

  export let data;
  $: ({entries, entries_per_page, search_params} = data)

  $: current_page_index = $search_params.page - 1 || 0
  let search_time: string
  let search_results_count: number
  $: number_of_pages = entries_into_pages(search_results_count ?? $entries?.length)
  let result_facets: FacetResult

  function entries_into_pages(count: number) {
    if (!count) return 0
    return Math.ceil(count / entries_per_page)
  }

  const page_entries = writable<ExpandedEntry[]>(null)
  setContext('entries', page_entries)

  let initial_entries_sent_to_page = false
  $: if ($entries) {
    if (!initial_entries_sent_to_page && $entries.length <= entries_per_page) {
      page_entries.set($entries)
      initial_entries_sent_to_page = true
    }
    search($search_params, current_page_index)
  }

  let search_inited_ms: number
  async function search(query_params: QueryParams, page_index: number) {
    try {
      const time = Date.now()
      search_inited_ms = time
      const {elapsed: { formatted }, count, hits, facets } = await entries.search(query_params, page_index, entries_per_page)
      if (search_inited_ms !== time) return
      result_facets = facets
      search_results_count = count
      search_time = formatted
      console.info({facets, hits, count})
      const entry_hits = hits.map(hit => hit.document) as ExpandedEntry[]
      page_entries.set(entry_hits)
    } catch (err) {
      console.error(err)
    }
  }
</script>

<ShowHide let:show={show_mobile_filters} let:toggle>
  <div
    class="flex mb-1 items-center sticky top-0 md:top-12 pt-2 md:pt-0 pb-1
      bg-white z-20 print:hidden">
    <SearchInput {search_params} on_show_filter_menu={toggle} />
  </div>

  <div class="flex">
    <div class="flex-grow w-0 relative">
      {#if $entries}
        <div class="print:hidden italic text-xs text-gray-500 mb-1">
          {#if typeof search_results_count === 'number'}
            {$page.data.t('dictionary.entries')}: {current_page_index * entries_per_page + 1}-{Math.min((current_page_index + 1) * entries_per_page, search_results_count)} /
            {search_results_count}
            ({search_time.includes('μs') ? '<1ms' : search_time})
          {:else}
            {$page.data.t('dictionary.entries')}:
            {$entries.length}
            <span class="i-svg-spinners-3-dots-fade align--4px" />
          {/if}
        </div>
      {/if}
      <slot />
      <Pagination bind:page_from_url={$search_params.page} {number_of_pages} />
    </div>
    <div class="hidden md:block w-2 flex-shrink-0 print:hidden" />
    <EntryFilters {search_params} {show_mobile_filters} on_close={toggle} {result_facets} />
  </div>
</ShowHide>
