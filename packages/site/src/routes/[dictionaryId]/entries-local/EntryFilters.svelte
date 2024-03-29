<script lang="ts">
  import { page } from '$app/stores';
  import { Button, ResponsiveSlideover, type QueryParamStore } from 'svelte-pieces';
  import type { FacetResult } from '@orama/orama';
  import ToggleFacet from './ToggleFacet.svelte';
  import type { QueryParams } from '$lib/search/types';
  import ClearFilters from './ClearFilters.svelte';
  import FilterList from './FilterList.svelte';
  import type { ISpeaker } from '@living-dictionaries/types';

  export let search_params: QueryParamStore<QueryParams>;
  export let show_mobile_filters = false;
  export let on_close: () => void
  export let result_facets: FacetResult
  export let speakers: ISpeaker[]
</script>

<ResponsiveSlideover
  side={$page.data.t('page.direction') === 'rtl' ? 'left' : 'right'}
  showWidth={'md'}
  open={show_mobile_filters}
  {on_close}>
  <section
    class="md:w-52 md:sticky md:top-24 h-100vh h-100dvh! md:max-h-[calc(100vh-107px)] print:hidden p-4 pl-3 md:p-0 flex flex-col">
    <header class="flex items-center justify-between space-x-3 mb-3 pl-1">
      <h2 class="text-lg leading-7 font-medium text-gray-900">
        {$page.data.t('entry.filters')}
      </h2>
      <ClearFilters {search_params} />
      <Button onclick={on_close} size="sm" form="filled" class="md:hidden">
        {$page.data.t('entry.view_entries')}
      </Button>
    </header>
    {#if result_facets}
      <div class="relative flex-1 overflow-y-auto overflow-x-clip pl-1">
        {#if result_facets.parts_of_speech.count}
          <FilterList
            {search_params}
            search_param_key="parts_of_speech"
            values={result_facets.parts_of_speech.values}
            label={$page.data.t('entry_field.parts_of_speech')} />
        {/if}
        {#if result_facets.semantic_domains.count}
          <FilterList
            {search_params}
            search_param_key="semantic_domains"
            values={result_facets.semantic_domains.values}
            label={$page.data.t('entry_field.semantic_domains')} />
        {/if}
        {#if result_facets.dialects.count}
          <FilterList
            {search_params}
            search_param_key="dialects"
            values={result_facets.dialects.values}
            label={$page.data.t('entry_field.dialects')} />
        {/if}
        {#if result_facets.speakers.count}
          <FilterList
            {search_params}
            search_param_key="speakers"
            values={result_facets.speakers.values}
            speaker_ids_to_names={speakers?.reduce((acc, speaker) => {
              acc[speaker.id] = speaker.displayName
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
              label={$page.data.t('entry.has_exists') + ' ' + $page.data.t('entry.image')} />
          {/if}
          {#if result_facets.has_image?.values.false}
            <ToggleFacet
              bind:checked={$search_params.no_image}
              count={result_facets.has_image.values.false}
              label={$page.data.t('entry.does_not_exist') + ' ' + $page.data.t('entry.image')} />
          {/if}
        {/if}
        {#if result_facets.has_audio?.values.true}
          <ToggleFacet
            bind:checked={$search_params.has_audio}
            count={result_facets.has_audio.values.true}
            label={$page.data.t('entry.has_exists') + ' ' + $page.data.t('entry_field.audio')} />
        {/if}
        {#if result_facets.has_audio?.values.false}
          <ToggleFacet
            bind:checked={$search_params.no_audio}
            count={result_facets.has_audio.values.false}
            label={$page.data.t('entry.does_not_exist') + ' ' + $page.data.t('entry_field.audio')} />
        {/if}
        {#if result_facets.has_video?.values.true}
          <ToggleFacet
            bind:checked={$search_params.has_video}
            count={result_facets.has_video.values.true}
            label={$page.data.t('entry.has_exists') + ' ' + $page.data.t('entry_field.video')} />
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
            label={$page.data.t('entry.has_exists') + ' ' + $page.data.t('entry_field.speaker')} />
        {/if}
        {#if result_facets.has_speaker?.values.false}
          <ToggleFacet
            bind:checked={$search_params.no_speaker}
            count={result_facets.has_speaker.values.false}
            label={$page.data.t('entry.does_not_exist') + ' ' + $page.data.t('entry_field.speaker')} />
        {/if}
        {#if result_facets.has_noun_class?.values.true}
          <ToggleFacet
            bind:checked={$search_params.has_noun_class}
            count={result_facets.has_noun_class.values.true}
            label={$page.data.t('entry.has_exists') + ' ' + $page.data.t('entry_field.noun_class')} />
        {/if}
        {#if result_facets.has_noun_class?.values.false}
          <ToggleFacet
            bind:checked={$search_params.no_noun_class}
            count={result_facets.has_noun_class.values.false}
            label={$page.data.t('entry.does_not_exist') + ' ' + $page.data.t('entry_field.noun_class')} />
        {/if}
        {#if result_facets.has_plural_form?.values.true}
          <ToggleFacet
            bind:checked={$search_params.has_plural_form}
            count={result_facets.has_plural_form.values.true}
            label={$page.data.t('entry.has_exists') + ' ' + $page.data.t('entry_field.plural_form')} />
        {/if}
        {#if result_facets.has_plural_form?.values.false}
          <ToggleFacet
            bind:checked={$search_params.no_plural_form}
            count={result_facets.has_plural_form.values.false}
            label={$page.data.t('entry.does_not_exist') + ' ' + $page.data.t('entry_field.plural_form')} />
        {/if}
        {#if result_facets.has_part_of_speech?.values.true}
          <ToggleFacet
            bind:checked={$search_params.has_part_of_speech}
            count={result_facets.has_part_of_speech.values.true}
            label={$page.data.t('entry.has_exists') + ' ' + $page.data.t('entry_field.parts_of_speech')} />
        {/if}
        {#if result_facets.has_part_of_speech?.values.false}
          <ToggleFacet
            bind:checked={$search_params.no_part_of_speech}
            count={result_facets.has_part_of_speech.values.false}
            label={$page.data.t('entry.does_not_exist') + ' ' + $page.data.t('entry_field.parts_of_speech')} />
        {/if}
        {#if result_facets.has_semantic_domain?.values.true}
          <ToggleFacet
            bind:checked={$search_params.has_semantic_domain}
            count={result_facets.has_semantic_domain.values.true}
            label={$page.data.t('entry.has_exists') + ' ' + $page.data.t('entry_field.semantic_domains')} />
        {/if}
        {#if result_facets.has_semantic_domain?.values.false}
          <ToggleFacet
            bind:checked={$search_params.no_semantic_domain}
            count={result_facets.has_semantic_domain.values.false}
            label={$page.data.t('entry.does_not_exist') + ' ' + $page.data.t('entry_field.semantic_domains')} />
        {/if}
      </div>
    {/if}
  </section>
</ResponsiveSlideover>
