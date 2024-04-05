<script lang="ts">
  import { ShowHide } from 'svelte-pieces'
  import type { ExpandedEntry } from '@living-dictionaries/types'
  import type { FacetResult } from '@orama/orama'
  import { writable } from 'svelte/store'
  import Pagination from './Pagination.svelte'
  import SwitchView from './SwitchView.svelte'
  import EntryFilters from './EntryFilters.svelte'
  import SearchInput from './SearchInput.svelte'
  import View from './View.svelte'
  import type { QueryParams } from '$lib/search/types'
  import { page } from '$app/stores'
  import { convert_and_expand_entry } from '$lib/transformers/convert_and_expand_entry'

  export let data
  $: ({ entries, status, search_entries, default_entries_per_page, search_params, speakers, dictionary, can_edit, edited_entries, dbOperations, citation_promise } = data)

  const page_entries = writable<ExpandedEntry[]>(null)

  $: current_page_index = $search_params.page - 1 || 0
  $: entries_per_page = $search_params.entries_per_page || default_entries_per_page
  let search_time: string
  let search_results_count: number
  $: number_of_pages = (() => {
    const count = search_results_count || $entries.size
    if (!count) return 0
    return Math.ceil(count / entries_per_page)
  })()
  let result_facets: FacetResult

  let cache_search_index_ready = false
  $: if ($status === 'Cache search index created')
    cache_search_index_ready = true

  let search_index_ready = false
  $: if ($status === 'Search index created')
    search_index_ready = true

  $: if ($entries.size && !cache_search_index_ready && !search_index_ready)
    page_entries.set(Array.from($entries.values()).slice(current_page_index * entries_per_page, (current_page_index + 1) * entries_per_page))

  $: console.info({ $entries, entry_count: $entries.size, $page_entries })
  $: console.info({ $status })

  $: if (cache_search_index_ready || search_index_ready)
    search($search_params, current_page_index)

  let search_inited_ms: number
  async function search(query_params: QueryParams, page_index: number) {
    try {
      const time = Date.now()
      search_inited_ms = time
      const { elapsed: { formatted }, count, hits, facets } = await search_entries({ query_params, page_index, entries_per_page, dictionary_id: $dictionary.id })
      if (search_inited_ms !== time) return
      result_facets = facets
      search_results_count = count
      search_time = formatted
      console.info({ facets, hits, count })
      const entry_hits = hits.map(hit => hit.document) as ExpandedEntry[]
      page_entries.set(entry_hits)
    } catch (err) {
      console.error(err)
    }
  }

  let updated_entries = new Map<string, ExpandedEntry>()

  $: {
    const combined_entries = new Map(($page_entries || []).map(entry => [entry.id, entry]));
    ($edited_entries || []).forEach((entry) => {
      const expandedEntry = convert_and_expand_entry(entry, $page.data.t)
      combined_entries.set(expandedEntry.id, expandedEntry)
    // TODO: detect if change happened and then run update_index_entry(expandedEntry)
    })
    updated_entries = combined_entries
  }
</script>

<ShowHide let:show={show_mobile_filters} let:toggle>
  <div
    class="flex mb-1 items-center sticky top-0 md:top-12 pt-2 md:pt-0 pb-1
      bg-white z-20 print:hidden">

    <SearchInput {search_params} index_ready={search_index_ready || cache_search_index_ready} on_show_filter_menu={toggle} />
    <div class="w-1" />
    <SwitchView bind:view={$search_params.view} can_print={$dictionary.printAccess || $can_edit} />
  </div>

  <div class="flex">
    <div class="flex-grow w-0 relative">
      <div class="print:hidden italic text-xs text-gray-500 mb-1">
        {#if typeof search_results_count === 'number'}
          {$page.data.t('dictionary.entries')}: {current_page_index * entries_per_page + 1}-{Math.min((current_page_index + 1) * entries_per_page, search_results_count)} /
          {search_results_count}
          ({search_time.includes('μs') ? '<1ms' : search_time})
        {:else}
          {$page.data.t('dictionary.entries')}:
          {$entries.size ? $entries.size : ''}
        {/if}
        {#if !search_index_ready}
          <span class="i-svg-spinners-3-dots-fade align--4px" title="Ensure all entries are up to date" />
        {/if}
      </div>
      <View entries={updated_entries} view={$search_params.view} page_data={data} {citation_promise} />
      <Pagination bind:page_from_url={$search_params.page} {number_of_pages} can_edit={$can_edit} addNewEntry={dbOperations.addNewEntry} />
    </div>
    <div class="hidden md:block w-2 flex-shrink-0 print:hidden" />
    <EntryFilters {search_params} {show_mobile_filters} on_close={toggle} {result_facets} speakers={$speakers} />
  </div>
</ShowHide>
