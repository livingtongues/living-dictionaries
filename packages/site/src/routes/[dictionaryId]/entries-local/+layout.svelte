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
  $: ({entries, entries_page_count, search_params} = data)

  $: if (!$search_params.page) $search_params.page = 1
  $: current_page_index = $search_params.page - 1
  $: number_of_pages = $entries ? Math.ceil($entries.length / entries_page_count) : 0

  const entries_for_page = writable<ExpandedEntry[]>(null)
  $: entries_for_page.set($entries?.slice(current_page_index * entries_page_count, $search_params.page * entries_page_count))

  setContext('entries', entries_for_page)

  $: if (browser)
    entries.search($search_params.query)

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
          {$page.data.t('dictionary.entries')}:
          {$entries.length}
        </div>
      {/if}
      <slot />
      <Pagination bind:current_page_number={$search_params.page} {number_of_pages} />
    </div>
    <div class="hidden md:block w-3 flex-shrink-0 print:hidden" />
    <EntryFilters {show_mobile_filters} on_close={toggle} />
  </div>
</ShowHide>
