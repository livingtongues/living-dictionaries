<script lang="ts">
  import { Button, type QueryParamStore, ResponsiveSlideover } from 'svelte-pieces'
  import type { FacetResult } from '@orama/orama'
  import ToggleFacet from './ToggleFacet.svelte'
  import ClearFilters from './ClearFilters.svelte'
  import FilterList from './FilterList.svelte'
  import type { QueryParams } from '$lib/search/types'
  import { page } from '$app/stores'
  import { restore_spaces_periods_from_underscores } from '$lib/search/augment-entry-for-search'

  export let search_params: QueryParamStore<QueryParams>
  export let show_mobile_filters = false
  export let on_close: () => void
  export let result_facets: FacetResult

  $: ({ tags, dialects, speakers } = $page.data)
</script>

<ResponsiveSlideover
  side={$page.data.t('page.direction') === 'rtl' ? 'left' : 'right'}
  showWidth="md"
  open={show_mobile_filters}
  {on_close}>
  <section
    class="md:w-52 md:sticky md:top-24 h-100vh h-100dvh! md:max-h-[calc(100vh-107px)] print:hidden p-4 pl-3 md:p-0 flex flex-col">
    {#if result_facets}
      <header class="flex items-center justify-between space-x-3 mb-3 pl-1">
        <h2 class="text-lg leading-7 font-medium text-gray-900">
          {$page.data.t('entry.filters')}
        </h2>
        <ClearFilters {search_params} />
        <Button onclick={on_close} size="sm" form="filled" class="md:hidden">
          {$page.data.t('entry.view_entries')}
        </Button>
      </header>
      <div class="relative flex-1 overflow-y-auto overflow-x-clip pl-1">
        <h4 class="text-sm font-semibold uppercase text-gray-700">Typo Tolerance</h4>
        <input
          class="w-full"
          type="range"
          value={$search_params.tolerance || 1}
          on:input={(e) => {
            // @ts-ignore
            const { value } = e.target
            $search_params.tolerance = value === '1' ? null : value
          }}
          min="0"
          max="5"
          step="1"
          list="tickmarks" />

        <datalist class="flex text-xs w-full px-.25 justify-between -mt-1" id="tickmarks">
          <option value="0" label="0"></option>
          <option value="1" label="1"></option>
          <option value="2" label="2"></option>
          <option value="3" label="3"></option>
          <option value="4" label="4"></option>
          <option value="5" label="5"></option>
        </datalist>

        <hr class="my-2" />

        {#if result_facets._tags.count}
          <FilterList
            {search_params}
            search_param_key="tags"
            values={result_facets._tags.values}
            keys_to_values={$tags?.reduce((acc, tag) => {
              acc[tag.id] = tag.name
              return acc
            }, {})}
            label={$page.data.t('entry_field.tag')} />
        {/if}
        {#if result_facets._parts_of_speech.count}
          <FilterList
            {search_params}
            search_param_key="parts_of_speech"
            values={result_facets._parts_of_speech.values}
            keys_to_values={Object.keys(result_facets._parts_of_speech.values).reduce((acc, _key) => {
              const key = restore_spaces_periods_from_underscores(_key)
              acc[key] = $page.data.t({ dynamicKey: `ps.${key}`, fallback: key })
              return acc
            }, {})}
            label={$page.data.t('entry_field.parts_of_speech')} />
        {/if}
        {#if result_facets._semantic_domains.count}
          <FilterList
            {search_params}
            search_param_key="semantic_domains"
            values={result_facets._semantic_domains.values}
            keys_to_values={Object.keys(result_facets._semantic_domains.values).reduce((acc, _key) => {
              const key = restore_spaces_periods_from_underscores(_key)
              acc[key] = $page.data.t({ dynamicKey: `sd.${key}`, fallback: key })
              return acc
            }, {})}
            label={$page.data.t('entry_field.semantic_domains')} />
        {/if}
        {#if result_facets._dialects.count}
          <FilterList
            {search_params}
            search_param_key="dialects"
            values={result_facets._dialects.values}
            keys_to_values={$dialects?.reduce((acc, dialect) => {
              acc[dialect.id] = dialect.name.default
              return acc
            }, {})}
            label={$page.data.t('entry_field.dialects')} />
        {/if}
        {#if result_facets._speakers.count}
          <FilterList
            {search_params}
            search_param_key="speakers"
            values={result_facets._speakers.values}
            keys_to_values={$speakers?.reduce((acc, speaker) => {
              acc[speaker.id] = speaker.name
              return acc
            }, {})}
            label={$page.data.t('entry_field.speaker')} />
        {/if}
        <hr />

        {#if $search_params.view !== 'gallery'}
          {#if result_facets.has_image?.values.true}
            <ToggleFacet
              bind:checked={$search_params.has_image}
              count={result_facets.has_image.values.true}
              label={`${$page.data.t('entry.has_exists')} ${$page.data.t('entry.image')}`} />
          {/if}
          {#if result_facets.has_image?.values.false}
            <ToggleFacet
              bind:checked={$search_params.no_image}
              count={result_facets.has_image.values.false}
              label={`${$page.data.t('entry.does_not_exist')} ${$page.data.t('entry.image')}`} />
          {/if}
        {/if}
        {#if result_facets.has_audio?.values.true}
          <ToggleFacet
            bind:checked={$search_params.has_audio}
            count={result_facets.has_audio.values.true}
            label={`${$page.data.t('entry.has_exists')} ${$page.data.t('entry_field.audio')}`} />
        {/if}
        {#if result_facets.has_audio?.values.false}
          <ToggleFacet
            bind:checked={$search_params.no_audio}
            count={result_facets.has_audio.values.false}
            label={`${$page.data.t('entry.does_not_exist')} ${$page.data.t('entry_field.audio')}`} />
        {/if}
        {#if result_facets.has_video?.values.true}
          <ToggleFacet
            bind:checked={$search_params.has_video}
            count={result_facets.has_video.values.true}
            label={`${$page.data.t('entry.has_exists')} ${$page.data.t('entry_field.video')}`} />
        {/if}
        <!-- If they are not yet using video, we are currently not advertising this feature -->
        <!-- {#if result_facets.has_video?.values.false}
        <ToggleFacet
          bind:checked={$search_params.no_video}
          count={result_facets.has_video.values.false}
          label={$page.data.t('entry.does_not_exist') + ' ' + $page.data.t('entry_field.video')} />
      {/if} -->
        {#if result_facets.has_speaker?.values.true}
          <ToggleFacet
            bind:checked={$search_params.has_speaker}
            count={result_facets.has_speaker.values.true}
            label={`${$page.data.t('entry.has_exists')} ${$page.data.t('entry_field.speaker')}`} />
        {/if}
        {#if result_facets.has_speaker?.values.false}
          <ToggleFacet
            bind:checked={$search_params.no_speaker}
            count={result_facets.has_speaker.values.false}
            label={`${$page.data.t('entry.does_not_exist')} ${$page.data.t('entry_field.speaker')}`} />
        {/if}
        {#if result_facets.has_noun_class?.values.true}
          <ToggleFacet
            bind:checked={$search_params.has_noun_class}
            count={result_facets.has_noun_class.values.true}
            label={`${$page.data.t('entry.has_exists')} ${$page.data.t('entry_field.noun_class')}`} />
        {/if}
        {#if result_facets.has_noun_class?.values.false}
          <ToggleFacet
            bind:checked={$search_params.no_noun_class}
            count={result_facets.has_noun_class.values.false}
            label={`${$page.data.t('entry.does_not_exist')} ${$page.data.t('entry_field.noun_class')}`} />
        {/if}
        {#if result_facets.has_plural_form?.values.true}
          <ToggleFacet
            bind:checked={$search_params.has_plural_form}
            count={result_facets.has_plural_form.values.true}
            label={`${$page.data.t('entry.has_exists')} ${$page.data.t('entry_field.plural_form')}`} />
        {/if}
        {#if result_facets.has_plural_form?.values.false}
          <ToggleFacet
            bind:checked={$search_params.no_plural_form}
            count={result_facets.has_plural_form.values.false}
            label={`${$page.data.t('entry.does_not_exist')} ${$page.data.t('entry_field.plural_form')}`} />
        {/if}
        {#if result_facets.has_part_of_speech?.values.true}
          <ToggleFacet
            bind:checked={$search_params.has_part_of_speech}
            count={result_facets.has_part_of_speech.values.true}
            label={`${$page.data.t('entry.has_exists')} ${$page.data.t('entry_field.parts_of_speech')}`} />
        {/if}
        {#if result_facets.has_part_of_speech?.values.false}
          <ToggleFacet
            bind:checked={$search_params.no_part_of_speech}
            count={result_facets.has_part_of_speech.values.false}
            label={`${$page.data.t('entry.does_not_exist')} ${$page.data.t('entry_field.parts_of_speech')}`} />
        {/if}
        {#if result_facets.has_semantic_domain?.values.true}
          <ToggleFacet
            bind:checked={$search_params.has_semantic_domain}
            count={result_facets.has_semantic_domain.values.true}
            label={`${$page.data.t('entry.has_exists')} ${$page.data.t('entry_field.semantic_domains')}`} />
        {/if}
        {#if result_facets.has_semantic_domain?.values.false}
          <ToggleFacet
            bind:checked={$search_params.no_semantic_domain}
            count={result_facets.has_semantic_domain.values.false}
            label={`${$page.data.t('entry.does_not_exist')} ${$page.data.t('entry_field.semantic_domains')}`} />
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
</style>
