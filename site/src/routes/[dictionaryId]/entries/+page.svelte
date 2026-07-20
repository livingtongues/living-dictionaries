<script lang="ts">
  import { onDestroy } from 'svelte'
  import type { FacetResult } from '@orama/orama'
  import Pagination from './Pagination.svelte'
  import SwitchView from './SwitchView.svelte'
  import EntryFilters from './EntryFilters.svelte'
  import SentenceFilters from './SentenceFilters.svelte'
  import SearchInput from './SearchInput.svelte'
  import SearchScopeChips from './SearchScopeChips.svelte'
  import View from './View.svelte'
  import SentenceResults from './SentenceResults.svelte'
  import TextResults from './TextResults.svelte'
  import EntriesEmptyState from './EntriesEmptyState.svelte'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import type { QueryParams } from '$lib/search/types'
  import type { MultiString } from '$lib/types'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import { browser } from '$app/environment'
  import { track, track_timing } from '$lib/debug/remote-log'
  import { SEARCH_PERFORMED } from '$lib/debug/log-events'
  import IconSvgSpinners3DotsFade from '~icons/svg-spinners/3-dots-fade'
  import IconFaSolidPlus from '~icons/fa-solid/plus'

  const { data } = $props()

  // let page_entries: EntryData[] = []
  let _hits = $state([])

  let search_time: string = $state()
  let search_results_count: number = $state()
  let result_facets: FacetResult = $state()

  let search_inited_ms: number

  // `search()` re-runs on every keystroke/page change; debounce the analytics
  // emission to the settled query so we log "what people searched for" + the
  // result count + the timing once per query, not once per character.
  const SEARCH_TRACK_DEBOUNCE_MS = 1200
  let search_track_timer: ReturnType<typeof setTimeout> | null = null
  function track_search_performed({ query, result_count, duration_ms }: { query: string, result_count: number, duration_ms: number }) {
    if (search_track_timer) clearTimeout(search_track_timer)
    search_track_timer = setTimeout(() => {
      track({ event: SEARCH_PERFORMED, props: { dictionary_id: dictionary.id, query: query.slice(0, 80), query_len: query.length, result_count, zero_results: result_count === 0, ...scope ? { scope } : {} } })
      track_timing({ name: 'search', duration_ms, context: { result_count } })
    }, SEARCH_TRACK_DEBOUNCE_MS)
  }

  async function search(query_params: QueryParams, page_index: number) {
    try {
      const time = Date.now()
      search_inited_ms = time
      const run = () => {
        if (query_params.scope === 'sentences')
          return search_sentences({ query_params, page_index, per_page: entries_per_page, dictionary_id: dictionary.id })
        if (query_params.scope === 'texts')
          return search_texts({ query_params, page_index, per_page: entries_per_page, dictionary_id: dictionary.id })
        return search_entries({ query_params, page_index, entries_per_page, dictionary_id: dictionary.id })
      }
      const { elapsed: { formatted }, count, hits, facets } = await run()
      if (search_inited_ms !== time) return
      result_facets = facets
      search_results_count = count
      search_time = formatted
      _hits = hits
      const query = (query_params.query || '').trim()
      if (query)
        track_search_performed({ query, result_count: count, duration_ms: Date.now() - time })
    } catch (err) {
      console.error(err)
    }
  }
  let { entries_data, auth_user, search_entries, search_sentences, search_texts, default_entries_per_page, search_params, dictionary, can_edit, is_manager, writes, search_index_updated } = $derived(data)
  onDestroy(() => search_params.destroy())

  // Navigation after create is a UI concern — the write facade just returns
  // the entry (undefined when the write was blocked/failed and toasted).
  async function add_entry(lexeme: MultiString) {
    const entry = await writes.insert_entry(lexeme)
    if (entry)
      await goto(`/${dictionary.url}/entry/${entry.id}`)
  }
  const { loading } = $derived(entries_data)
  // Corpus scopes (sentences/texts) are an admin-3 preview while iterated on —
  // see .issues/texts-sentences-pipeline.md. Gate must not shape the views.
  const show_scope_chips = $derived(auth_user.admin_level >= 3)
  const scope = $derived(show_scope_chips ? search_params.value.scope : undefined)
  const entries_length = $derived(Object.keys($entries_data).length)
  const current_page_index = $derived(search_params.value.page - 1 || 0)
  let entries_per_page = $derived(search_params.value.entries_per_page || default_entries_per_page)
  const number_of_pages = $derived((() => {
    const count = search_results_count ?? entries_length
    if (!count) return 0
    return Math.ceil(count / entries_per_page)
  })())
  $effect(() => {
    // read unconditionally so index rebuilds re-run the open query — behind a
    // short-circuit (`browser || $x`) it was never tracked as a dependency
    void $search_index_updated
    if (browser) {
      search({ ...search_params.value, scope }, current_page_index)
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

  const results_label = $derived.by(() => {
    if (scope === 'sentences') return page.data.t('sentence.sentences')
    if (scope === 'texts') return page.data.t('dictionary.texts')
    return page.data.t('dictionary.entries')
  })

  const search_placeholder = $derived.by(() => {
    if (scope === 'sentences') return page.data.t('sentence.search_sentences')
    if (scope === 'texts') return page.data.t('dictionary.texts')
    return undefined // SearchInput's default: t('entry.search_entries')
  })
</script>

<ShowHide>
  {#snippet children({ show: show_mobile_filters, toggle })}
    {#if entries_length === 0 && !$loading && !scope}
      <!-- `$loading` only means the LOCAL bundle read + index build finished. On a
        cold boot without a snapshot (fetch failed → empty DB, sync backfills via
        /changes) that read returns 0 rows while the pull is still in flight — so
        when the server catalog says entries exist, show a loading state instead
        of the misleading empty state. Rows stream in reactively as sync applies. -->
      {#if dictionary.entry_count > 0}
        <div class="sync-pending">
          <IconSvgSpinners3DotsFade style="font-size: 1.5rem" />
          <div>{page.data.t('misc.loading')}…</div>
        </div>
      {:else}
        <EntriesEmptyState {dictionary} {can_edit} {is_manager} {add_entry} />
      {/if}
    {:else}
      {#if show_scope_chips}
        <SearchScopeChips {search_params} />
      {/if}
      <div class="search-bar">

        <SearchInput {search_params} index_ready={true} on_show_filter_menu={toggle} placeholder={search_placeholder} focus_on_mount={!!page.state.focus_search} />
        <div style="width: 0.25rem"></div>
        {#if !scope}
          <SwitchView bind:view={search_params.value.view} can_print={!!dictionary.print_access || can_edit} />
        {/if}
      </div>

      <div style="display: flex">
        <div class="results-pane">
          <div class="results-meta">
            {#if typeof search_results_count !== 'undefined'}
              {#if search_results_count > 0}
                {results_label}: {current_page_index * entries_per_page + 1}-{Math.min((current_page_index + 1) * entries_per_page, search_results_count)} /
                {search_results_count}
                ({search_time.includes('μs') ? '<1ms' : search_time})
              {:else}
                {results_label}:
                0 /
                {scope ? 0 : entries_length}
              {/if}
            {/if}
            {#if $loading}
              <span class="loading-spinner" title="Ensuring all entries are up to date"><IconSvgSpinners3DotsFade style="vertical-align: -4px" /></span>
            {/if}
          </div>
          {#if scope === 'sentences'}
            <SentenceResults hits={_hits} />
          {:else if scope === 'texts'}
            <TextResults hits={_hits} />
          {:else}
            <View entries={page_entries} page_data={data} />
          {/if}
          <Pagination bind:page_from_url={search_params.value.page} {number_of_pages} can_edit={can_edit}>
            <!-- Scope-adaptive add button (texts get theirs with the M2 ingest flow). -->
            {#snippet add_button(placement_class: string)}
              {#if scope === 'sentences'}
                {#await import('./AddSentence.svelte') then { default: AddSentence }}
                  <AddSentence class={placement_class} />
                {/await}
              {:else if scope === 'texts'}
                {#await import('$lib/components/ui/HeadlessButton.svelte') then { default: HeadlessButton }}
                  <HeadlessButton class="btn-primary btn-default add-entry-button {placement_class}" href={`/${dictionary.url}/texts/new`}>
                    <IconFaSolidPlus style="margin-top: -0.25rem" />
                    {page.data.t('text.new')}
                  </HeadlessButton>
                {/await}
              {:else if !scope}
                {#await import('./AddEntry.svelte') then { default: AddEntry }}
                  <AddEntry {add_entry} class={placement_class} />
                {/await}
              {/if}
            {/snippet}
          </Pagination>
        </div>
        <div class="filters-gap"></div>
        {#if scope === 'sentences'}
          <SentenceFilters {search_params} {show_mobile_filters} on_close={toggle} {result_facets} />
        {:else if !scope}
          <EntryFilters {search_params} {show_mobile_filters} on_close={toggle} {result_facets} total={search_results_count} />
        {/if}
      </div>
    {/if}
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

  .sync-pending {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 4rem 1rem;
    color: var(--color-secondary);
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
