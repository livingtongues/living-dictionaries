<script lang="ts">
  import { Button, ShowHide } from 'svelte-pieces'
  import type { FacetResult } from '@orama/orama'
  import Pagination from './Pagination.svelte'
  import SwitchView from './SwitchView.svelte'
  import EntryFilters from './EntryFilters.svelte'
  import SearchInput from './SearchInput.svelte'
  import View from './View.svelte'
  import type { QueryParams } from '$lib/search/types'
  import { page } from '$app/stores'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import { browser, dev } from '$app/environment'

  export let data
  $: ({ entries_data, admin, search_entries, default_entries_per_page, search_params, dictionary, can_edit, dbOperations, reset_caches, search_index_updated } = data)
  $: ({ loading, error: entries_error } = entries_data)

  // let page_entries: EntryData[] = []
  let _hits = []

  $: current_page_index = $search_params.page - 1 || 0
  $: entries_per_page = $search_params.entries_per_page || default_entries_per_page
  let search_time: string
  let search_results_count: number
  $: number_of_pages = (() => {
    const count = search_results_count ?? $entries_data.length
    if (!count) return 0
    return Math.ceil(count / entries_per_page)
  })()
  let result_facets: FacetResult

  $: if (browser || $search_index_updated) {
    search($search_params, current_page_index)
  }

  let search_inited_ms: number

  async function search(query_params: QueryParams, page_index: number) {
    try {
      const time = Date.now()
      search_inited_ms = time
      const { elapsed: { formatted }, count, hits, facets } = await search_entries({ query_params, page_index, entries_per_page, dictionary_id: dictionary.id })
      if (search_inited_ms !== time) return
      result_facets = facets
      search_results_count = count
      search_time = formatted
      console.info({ facets, hits, count })
      _hits = hits
    } catch (err) {
      console.error(err)
    }
  }
  $: page_entries = $entries_data.filter(entry => _hits.some(hit => hit.id === entry.id))
</script>

<ShowHide let:show={show_mobile_filters} let:toggle>
  <div
    class="flex mb-1 items-center sticky top-0 md:top-12 pt-2 md:pt-0 pb-1
      bg-white z-20 print:hidden">

    <SearchInput {search_params} index_ready={$entries_data.length} on_show_filter_menu={toggle} />
    <div class="w-1" />
    <SwitchView bind:view={$search_params.view} can_print={dictionary.print_access || $can_edit} />
  </div>

  <div class="flex">
    <div class="flex-grow w-0 relative">
      <div class="print:hidden italic text-xs text-gray-500 mb-1 flex">
        {#if typeof search_results_count !== 'undefined'}
          {#if search_results_count > 0}
            {$page.data.t('dictionary.entries')}: {current_page_index * entries_per_page + 1}-{Math.min((current_page_index + 1) * entries_per_page, search_results_count)} /
            {search_results_count}
            ({search_time.includes('μs') ? '<1ms' : search_time})
          {:else}
            {$page.data.t('dictionary.entries')}:
            0 /
            {$entries_data.length}
          {/if}
          {#if dev || $admin}
            <div class="grow"></div>
            <Button
              type="button"
              size="sm"
              form="simple"
              onclick={async () => {
                await reset_caches()
                location.reload()
              }}>Reset local caches (admin)</Button>
          {/if}
        {/if}
        {#if $loading}
          <span class="i-svg-spinners-3-dots-fade align--4px md:hidden" title="Ensuring all entries are up to date" />
        {/if}
      </div>
      {#if $entries_error}
        <div class="text-red text-sm">Entries loading error: {$entries_error} (reload page if results are not working properly.)</div>
      {/if}
      <View entries={page_entries} page_data={data} />
      <Pagination bind:page_from_url={$search_params.page} {number_of_pages} can_edit={$can_edit} add_entry={dbOperations.insert_entry} />
    </div>
    <div class="hidden md:block w-2 flex-shrink-0 print:hidden" />
    <EntryFilters {search_params} {show_mobile_filters} on_close={toggle} {result_facets} />
  </div>
</ShowHide>

<SeoMetaTags
  norobots={!dictionary.public}
  admin={$admin > 0}
  title="Entries"
  dictionaryName={dictionary.name}
  gcsPath={dictionary.featured_image?.specifiable_image_url}
  lng={dictionary.coordinates?.points?.[0]?.coordinates.longitude}
  lat={dictionary.coordinates?.points?.[0]?.coordinates.latitude}
  description="The entries in this Living Dictionary are displayed in a comprehensive list that visitors can easily browse by using the page tabs at the bottom of the screen, or search by using the powerful search bar located at the top of the page."
  keywords="Endangered Languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Edit a dictionary, Search a dictionary, Browse a dictionary, Explore a Dictionary" />
