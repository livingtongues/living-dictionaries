<script lang="ts">
  import type { FacetResult } from '@orama/orama'
  import ToggleFacet from './ToggleFacet.svelte'
  import ClearFilters from './ClearFilters.svelte'
  import FilterList from './FilterList.svelte'
  import { Button, ResponsiveSlideover } from '$lib/svelte-pieces'
  import type { QueryParamStore } from '$lib/svelte-pieces'
  import type { QueryParams } from '$lib/search/types'
  import { page } from '$app/state'
  import { restore_spaces_periods_from_underscores } from '$lib/search/augment-entry-for-search'

  interface Props {
    search_params: QueryParamStore<QueryParams>
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

  const { tags, dialects, speakers, sources } = $derived(page.data)
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
        <Button onclick={on_close} size="sm" form="filled" class="view-entries-button">
          {page.data.t('entry.view_entries')}
        </Button>
      </header>
      <div class="filter-scroll">
        <h4>Typo Tolerance</h4>
        <input
          style="width: 100%"
          type="range"
          value={$search_params.tolerance || 0}
          oninput={(e) => {
            // @ts-ignore
            const { value } = e.target
            $search_params.tolerance = value === '1' ? null : value
          }}
          min="0"
          max="5"
          step="1"
          list="tickmarks" />

        <datalist class="tickmarks" id="tickmarks">
          <option value="0" label="0"></option>
          <option value="1" label="1"></option>
          <option value="2" label="2"></option>
          <option value="3" label="3"></option>
          <option value="4" label="4"></option>
          <option value="5" label="5"></option>
        </datalist>

        <hr class="tolerance-divider" />

        {#if result_facets._sources?.count}
          <FilterList
            {search_params}
            search_param_key="sources"
            values={result_facets._sources.values}
            keys_to_values={source_labels}
            label={page.data.t('entry_field.sources')} />
        {/if}
        {#if result_facets._parts_of_speech.count}
          <FilterList
            {search_params}
            search_param_key="parts_of_speech"
            values={result_facets._parts_of_speech.values}
            keys_to_values={Object.keys(result_facets._parts_of_speech.values).reduce((acc, _key) => {
              const key = restore_spaces_periods_from_underscores(_key)
              acc[key] = page.data.t({ dynamicKey: `ps.${key}`, fallback: key })
              return acc
            }, {})}
            label={page.data.t('entry_field.parts_of_speech')} />
        {/if}
        {#if result_facets._semantic_domains.count}
          <FilterList
            {search_params}
            search_param_key="semantic_domains"
            values={result_facets._semantic_domains.values}
            keys_to_values={Object.keys(result_facets._semantic_domains.values).reduce((acc, _key) => {
              const key = restore_spaces_periods_from_underscores(_key)
              acc[key] = page.data.t({ dynamicKey: `sd.${key}`, fallback: key })
              return acc
            }, {})}
            label={page.data.t('entry_field.semantic_domains')} />
        {/if}
        {#if result_facets._dialects.count}
          <FilterList
            {search_params}
            search_param_key="dialects"
            values={result_facets._dialects.values}
            label={page.data.t('entry_field.dialects')} />
        {/if}
        {#if result_facets._tags.count}
          <FilterList
            {search_params}
            search_param_key="tags"
            values={result_facets._tags.values}
            label={page.data.t('entry_field.custom_tags')} />
        {/if}
        {#if result_facets._speakers.count}
          <FilterList
            {search_params}
            search_param_key="speakers"
            values={result_facets._speakers.values}
            label={page.data.t('entry_field.speaker')} />
        {/if}

        <hr />

        {#if result_facets.has_sentence?.values.true}
          <ToggleFacet
            bind:checked={$search_params.has_sentence}
            count={result_facets.has_sentence.values.true}
            label={`${page.data.t('entry.has_exists')} ${page.data.t('entry_field.example_sentence')}`} />
        {/if}
        {#if result_facets.has_sentence?.values.false && result_facets.has_sentence?.values.true}
          <ToggleFacet
            bind:checked={$search_params.no_sentence}
            count={result_facets.has_sentence.values.false}
            label={`${page.data.t('entry.does_not_exist')} ${page.data.t('entry_field.example_sentence')}`} />
        {/if}
        {#if $search_params.view !== 'gallery'}
          {#if result_facets.has_image?.values.true}
            <ToggleFacet
              bind:checked={$search_params.has_image}
              count={result_facets.has_image.values.true}
              label={`${page.data.t('entry.has_exists')} ${page.data.t('entry.image')}`} />
          {/if}
          {#if result_facets.has_image?.values.false && result_facets.has_image?.values.true}
            <ToggleFacet
              bind:checked={$search_params.no_image}
              count={result_facets.has_image.values.false}
              label={`${page.data.t('entry.does_not_exist')} ${page.data.t('entry.image')}`} />
          {/if}
        {/if}
        {#if result_facets.has_audio?.values.true}
          <ToggleFacet
            bind:checked={$search_params.has_audio}
            count={result_facets.has_audio.values.true}
            label={`${page.data.t('entry.has_exists')} ${page.data.t('entry_field.audio')}`} />
        {/if}
        {#if result_facets.has_audio?.values.false && result_facets.has_audio?.values.true}
          <ToggleFacet
            bind:checked={$search_params.no_audio}
            count={result_facets.has_audio.values.false}
            label={`${page.data.t('entry.does_not_exist')} ${page.data.t('entry_field.audio')}`} />
        {/if}
        {#if result_facets.has_video?.values.true}
          <ToggleFacet
            bind:checked={$search_params.has_video}
            count={result_facets.has_video.values.true}
            label={`${page.data.t('entry.has_exists')} ${page.data.t('entry_field.video')}`} />
        {/if}
        <!-- If they are not yet using video, we are currently not advertising this feature -->
        <!-- {#if result_facets.has_video?.values.false}
        <ToggleFacet
          bind:checked={$search_params.no_video}
          count={result_facets.has_video.values.false}
          label={page.data.t('entry.does_not_exist') + ' ' + page.data.t('entry_field.video')} />
      {/if} -->
        {#if result_facets.has_speaker?.values.true}
          <ToggleFacet
            bind:checked={$search_params.has_speaker}
            count={result_facets.has_speaker.values.true}
            label={`${page.data.t('entry.has_exists')} ${page.data.t('entry_field.speaker')}`} />
        {/if}
        {#if result_facets.has_speaker?.values.false && result_facets.has_speaker?.values.true}
          <ToggleFacet
            bind:checked={$search_params.no_speaker}
            count={result_facets.has_speaker.values.false}
            label={`${page.data.t('entry.does_not_exist')} ${page.data.t('entry_field.speaker')}`} />
        {/if}
        {#if result_facets.has_noun_class?.values.true}
          <ToggleFacet
            bind:checked={$search_params.has_noun_class}
            count={result_facets.has_noun_class.values.true}
            label={`${page.data.t('entry.has_exists')} ${page.data.t('entry_field.noun_class')}`} />
        {/if}
        {#if result_facets.has_noun_class?.values.false && result_facets.has_noun_class?.values.true}
          <ToggleFacet
            bind:checked={$search_params.no_noun_class}
            count={result_facets.has_noun_class.values.false}
            label={`${page.data.t('entry.does_not_exist')} ${page.data.t('entry_field.noun_class')}`} />
        {/if}
        {#if result_facets.has_plural_form?.values.true}
          <ToggleFacet
            bind:checked={$search_params.has_plural_form}
            count={result_facets.has_plural_form.values.true}
            label={`${page.data.t('entry.has_exists')} ${page.data.t('entry_field.plural_form')}`} />
        {/if}
        {#if result_facets.has_plural_form?.values.false && result_facets.has_plural_form?.values.true}
          <ToggleFacet
            bind:checked={$search_params.no_plural_form}
            count={result_facets.has_plural_form.values.false}
            label={`${page.data.t('entry.does_not_exist')} ${page.data.t('entry_field.plural_form')}`} />
        {/if}
        {#if result_facets.has_part_of_speech?.values.true}
          <ToggleFacet
            bind:checked={$search_params.has_part_of_speech}
            count={result_facets.has_part_of_speech.values.true}
            label={`${page.data.t('entry.has_exists')} ${page.data.t('entry_field.parts_of_speech')}`} />
        {/if}
        {#if result_facets.has_part_of_speech?.values.false && result_facets.has_part_of_speech?.values.true}
          <ToggleFacet
            bind:checked={$search_params.no_part_of_speech}
            count={result_facets.has_part_of_speech.values.false}
            label={`${page.data.t('entry.does_not_exist')} ${page.data.t('entry_field.parts_of_speech')}`} />
        {/if}
        {#if result_facets.has_semantic_domain?.values.true}
          <ToggleFacet
            bind:checked={$search_params.has_semantic_domain}
            count={result_facets.has_semantic_domain.values.true}
            label={`${page.data.t('entry.has_exists')} ${page.data.t('entry_field.semantic_domains')}`} />
        {/if}
        {#if result_facets.has_semantic_domain?.values.false && result_facets.has_semantic_domain?.values.true}
          <ToggleFacet
            bind:checked={$search_params.no_semantic_domain}
            count={result_facets.has_semantic_domain.values.false}
            label={`${page.data.t('entry.does_not_exist')} ${page.data.t('entry_field.semantic_domains')}`} />
        {/if}
      </div>
    {/if}
  </section>
</ResponsiveSlideover>

<style>
  datalist option {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 1em;
    height: 1em;
  }

  .filters {
    height: 100vh;
    height: 100dvh; /* (was h-100vh + h-100dvh! — dvh wins where supported) */
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

  @media print {
    .filters {
      display: none;
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
    margin-left: 0.75rem; /* space-x-3 */
  }

  h2 {
    font-size: 1.125rem;
    line-height: 1.75rem;
    font-weight: 500;
    color: var(--color); /* ≈ gray-900 */
  }

  .filter-scroll {
    position: relative;
    flex: 1 1 0%;
    overflow-y: auto;
    overflow-x: clip;
    padding-left: 0.25rem;
  }

  h4 {
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 600;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--color) 85%, var(--background)); /* ≈ gray-700 */
  }

  .tickmarks {
    display: flex;
    font-size: 0.75rem;
    line-height: 1rem;
    width: 100%;
    padding-left: 0.0625rem;
    padding-right: 0.0625rem;
    justify-content: space-between;
    margin-top: -0.25rem;
  }

  .tolerance-divider {
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
  }
</style>
