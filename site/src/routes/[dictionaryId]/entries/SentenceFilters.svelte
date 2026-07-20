<script lang="ts">
  import type { FacetResult } from '@orama/orama'
  import ToggleFacet from './ToggleFacet.svelte'
  import ClearFilters from './ClearFilters.svelte'
  import FilterList from './FilterList.svelte'
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import ResponsiveSlideover from '$lib/components/ui/ResponsiveSlideover.svelte'
  import type { QueryParamState } from '$lib/state/query-param-state.svelte'
  import type { QueryParams } from '$lib/search/types'
  import { page } from '$app/state'

  interface Props {
    search_params: QueryParamState<QueryParams>
    show_mobile_filters?: boolean
    on_close: () => void
    result_facets: FacetResult
  }

  const {
    search_params,
    show_mobile_filters = false,
    on_close,
    result_facets,
  }: Props = $props()

  const { sources } = $derived(page.data)
  const source_labels = $derived(Object.fromEntries(($sources || []).map(source => [source.slug, source.abbreviation || source.citation || source.slug])))
</script>

<ResponsiveSlideover
  side={page.data.t('page.direction') === 'rtl' ? 'left' : 'right'}
  showWidth="md"
  open={show_mobile_filters}
  {on_close}>
  <section class="filters">
    {#if result_facets}
      <header class="filters-header">
        <h2>
          {page.data.t('entry.filters')}
        </h2>
        <ClearFilters {search_params} />
        <HeadlessButton onclick={on_close} class="btn-primary btn-sm view-entries-button">
          {page.data.t('sentence.sentences')}
        </HeadlessButton>
      </header>
      <div class="filter-scroll">
        {#if result_facets._sources?.count}
          <FilterList
            {search_params}
            search_param_key="sources"
            values={result_facets._sources.values}
            keys_to_values={source_labels}
            label={page.data.t('entry_field.sources')} />
        {/if}

        {#if result_facets.in_text?.values.true && result_facets.in_text?.values.false}
          <ToggleFacet
            bind:checked={search_params.value.in_text}
            count={result_facets.in_text.values.true}
            label={page.data.t('sentence.in_text')} />
          <ToggleFacet
            bind:checked={search_params.value.standalone}
            count={result_facets.in_text.values.false}
            label={page.data.t('sentence.standalone')} />
        {/if}
        {#if result_facets.has_translation?.values.true}
          <ToggleFacet
            bind:checked={search_params.value.has_translation}
            count={result_facets.has_translation.values.true}
            label={`${page.data.t('entry.has_exists')} ${page.data.t('sentence.translation')}`} />
        {/if}
        {#if result_facets.has_translation?.values.false && result_facets.has_translation?.values.true}
          <ToggleFacet
            bind:checked={search_params.value.no_translation}
            count={result_facets.has_translation.values.false}
            label={`${page.data.t('entry.does_not_exist')} ${page.data.t('sentence.translation')}`} />
        {/if}
        {#if result_facets.has_audio?.values.true}
          <ToggleFacet
            bind:checked={search_params.value.has_audio}
            count={result_facets.has_audio.values.true}
            label={`${page.data.t('entry.has_exists')} ${page.data.t('entry_field.audio')}`} />
        {/if}
        {#if result_facets.has_audio?.values.false && result_facets.has_audio?.values.true}
          <ToggleFacet
            bind:checked={search_params.value.no_audio}
            count={result_facets.has_audio.values.false}
            label={`${page.data.t('entry.does_not_exist')} ${page.data.t('entry_field.audio')}`} />
        {/if}
        {#if result_facets.has_image?.values.true}
          <ToggleFacet
            bind:checked={search_params.value.has_image}
            count={result_facets.has_image.values.true}
            label={`${page.data.t('entry.has_exists')} ${page.data.t('entry.image')}`} />
        {/if}
        {#if result_facets.has_video?.values.true}
          <ToggleFacet
            bind:checked={search_params.value.has_video}
            count={result_facets.has_video.values.true}
            label={`${page.data.t('entry.has_exists')} ${page.data.t('entry_field.video')}`} />
        {/if}
      </div>
    {/if}
  </section>
</ResponsiveSlideover>

<style>
  .filters {
    height: 100vh;
    height: 100dvh;
    padding: 1rem;
    padding-left: 0.75rem;
    display: flex;
    flex-direction: column;
  }

  @media (min-width: 768px) {
    .filters {
      width: 13rem;
      position: sticky;
      top: 6rem;
      height: 100vh;
      height: 100dvh;
      max-height: calc(100vh - 107px);
      padding: 0;
    }

    .filters :global(.view-entries-button) {
      display: none !important;
    }
  }

  .filters-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
    padding-left: 0.25rem;
  }

  .filters-header > :global(:not([hidden]) ~ :not([hidden])) {
    margin-left: 0.75rem;
  }

  h2 {
    font-size: 1.125rem;
    line-height: 1.75rem;
    font-weight: 500;
    color: var(--color);
  }

  .filter-scroll {
    position: relative;
    flex: 1 1 0%;
    overflow-y: auto;
    overflow-x: clip;
    padding-left: 0.25rem;
  }
</style>
