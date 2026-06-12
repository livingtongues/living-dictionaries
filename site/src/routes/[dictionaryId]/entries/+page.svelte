<script lang="ts">
  import { run } from 'svelte/legacy'

  import type { FacetResult } from '@orama/orama'
  import Pagination from './Pagination.svelte'
  import SwitchView from './SwitchView.svelte'
  import EntryFilters from './EntryFilters.svelte'
  import SearchInput from './SearchInput.svelte'
  import View from './View.svelte'
  import { Button, ShowHide } from '$lib/svelte-pieces'
  import type { QueryParams } from '$lib/search/types'
  import { page } from '$app/stores'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import { browser } from '$app/environment'
  import IconSvgSpinners3DotsFade from '~icons/svg-spinners/3-dots-fade'

  const { data } = $props()

  // let page_entries: EntryData[] = []
  let _hits = $state([])

  let search_time: string = $state()
  let search_results_count: number = $state()
  let result_facets: FacetResult = $state()

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
  let { entries_data, auth_user, search_entries, default_entries_per_page, search_params, dictionary, can_edit, dbOperations, reset_caches, search_index_updated } = $derived(data)
  const { loading } = $derived(entries_data)
  const entries_length = $derived(Object.keys(entries_data).length)
  const current_page_index = $derived($search_params.page - 1 || 0)
  let entries_per_page = $derived($search_params.entries_per_page || default_entries_per_page)
  const number_of_pages = $derived((() => {
    const count = search_results_count ?? entries_length
    if (!count) return 0
    return Math.ceil(count / entries_per_page)
  })())
  run(() => {
    if (browser || $search_index_updated) {
      search($search_params, current_page_index)
    }
  })
  const page_entries = $derived(_hits.map((hit) => {
    const entry = $entries_data[hit.id]
    if (!entry) return null
    return {
      ...entry,
      score: hit.score,
    }
  }).filter(Boolean))
</script>

<ShowHide>
  {#snippet children({ show: show_mobile_filters, toggle })}
    <div class="search-bar">

      <SearchInput {search_params} index_ready={true} on_show_filter_menu={toggle} />
      <div style="width: 0.25rem"></div>
      <SwitchView bind:view={$search_params.view} can_print={!!dictionary.print_access || can_edit} />
    </div>

    <div style="display: flex">
      <div class="results-pane">
        <div class="results-meta">
          {#if typeof search_results_count !== 'undefined'}
            {#if search_results_count > 0}
              {$page.data.t('dictionary.entries')}: {current_page_index * entries_per_page + 1}-{Math.min((current_page_index + 1) * entries_per_page, search_results_count)} /
              {search_results_count}
              ({search_time.includes('μs') ? '<1ms' : search_time})
            {:else}
              {$page.data.t('dictionary.entries')}:
              0 /
              {entries_length}
            {/if}
            {#if can_edit}
              <div style="flex-grow: 1"></div>
              <Button
                type="button"
                size="sm"
                form="simple"
                title="Use if some entries are not showing up. Sometimes if you go in and out of internet service while loading entries, some will fail to load."
                onclick={async () => {
                  await reset_caches()
                  location.reload()
                }}>Reset Cache</Button>
            {/if}
          {/if}
          {#if $loading}
            <span class="loading-spinner" title="Ensuring all entries are up to date"><IconSvgSpinners3DotsFade class="icon-inline" style="vertical-align: -4px" /></span>
          {/if}
        </div>
        <!-- {#if $entries_error}
          <div class="text-red text-sm">Entries loading error: {$entries_error} (reload page if results are not working properly.)</div>
        {/if} -->
        <View entries={page_entries} page_data={data} />
        <Pagination bind:page_from_url={$search_params.page} {number_of_pages} can_edit={can_edit} add_entry={dbOperations.insert_entry} />
      </div>
      <div class="filters-gap"></div>
      <EntryFilters {search_params} {show_mobile_filters} on_close={toggle} {result_facets} />
    </div>
  {/snippet}
</ShowHide>

<style>
  .search-bar {
    display: flex;
    margin-bottom: 0.25rem;
    align-items: center;
    position: sticky;
    top: 0;
    padding-top: 0.5rem;
    padding-bottom: 0.25rem;
    background-color: var(--background);
    z-index: 20;
  }

  .results-pane {
    flex-grow: 1;
    width: 0;
    position: relative;
  }

  .results-meta {
    font-style: italic;
    font-size: 0.75rem;
    line-height: 1rem;
    color: var(--color-secondary); /* ≈ gray-500 */
    margin-bottom: 0.25rem;
    display: flex;
  }

  .filters-gap {
    display: none;
    width: 0.5rem;
    flex-shrink: 0;
  }

  @media (min-width: 768px) {
    .search-bar {
      top: 3rem;
      padding-top: 0;
    }

    .loading-spinner {
      display: none;
    }

    .filters-gap {
      display: block;
    }
  }

  @media print {
    .search-bar,
    .results-meta,
    .filters-gap {
      display: none;
    }
  }
</style>

<SeoMetaTags
  norobots={!dictionary.public}
  admin={auth_user.admin_level > 0}
  title="Entries"
  dictionaryName={dictionary.name}
  gcsPath={dictionary.featured_image?.serving_url}
  lng={dictionary.coordinates?.points?.[0]?.coordinates.longitude}
  lat={dictionary.coordinates?.points?.[0]?.coordinates.latitude}
  description="The entries in this Living Dictionary are displayed in a comprehensive list that visitors can easily browse by using the page tabs at the bottom of the screen, or search by using the powerful search bar located at the top of the page."
  keywords="Endangered Languages, Language Documentation, Language Revitalization, Build a Dictionary, Online Dictionary, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Living Dictionaries, Living Dictionary, Edit a dictionary, Search a dictionary, Browse a dictionary, Explore a Dictionary" />
