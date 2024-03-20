<script lang="ts">
  import { page } from '$app/stores';
  import { Button, ResponsiveSlideover, type QueryParamStore } from 'svelte-pieces';
  import type { FacetResult } from '@orama/orama';
  import ToggleFacet from './ToggleFacet.svelte';
  import type { QueryParams } from '$lib/search/types';
  import ClearFilters from './ClearFilters.svelte';

  export let search_params: QueryParamStore<QueryParams>;
  export let show_mobile_filters = false;
  export let on_close: () => void
  export let result_facets: FacetResult
</script>

<ResponsiveSlideover
  side={$page.data.t('page.direction') === 'rtl' ? 'left' : 'right'}
  showWidth={'md'}
  open={show_mobile_filters}
  {on_close}>
  <section
    class="md:w-52 md:sticky md:top-24 md:max-h-[calc(100vh-107px)] print:hidden p-4 md:p-0 md:overflow-y-auto">
    <header class="flex items-center justify-between space-x-3">
      <h2 class="text-lg leading-7 font-medium text-gray-900 mb-3">
        {$page.data.t('entry.filters')}
      </h2>
      <ClearFilters {search_params} />
      <Button onclick={on_close} size="sm" form="filled" class="md:hidden">
        {$page.data.t('entry.view_entries')}
      </Button>
    </header>
    <div class="relative flex-1 overflow-y-auto">
      <!-- <FilterList
        attribute="ps"
        label={$page.data.t('entry_field.parts_of_speech')} />
      <RefinementList
        attribute="sdn"
        label={$page.data.t('entry_field.semantic_domains')} />
      <RefinementList
        attribute="di"
        label={$page.data.t('entry_field.dialects')} />
      <RefinementList
        attribute="sf.speakerName"
        label={$page.data.t('entry_field.speaker')} /> -->
      <hr />

      {#if !$page.url.pathname.includes('gallery')}
        {#if result_facets?.has_image?.values.true}
          <ToggleFacet
            bind:checked={$search_params.has_image}
            count={result_facets.has_image.values.true}
            label={$page.data.t('entry.has_exists') + ' ' + $page.data.t('entry.image')} />
        {/if}
        {#if result_facets?.has_image?.values.false}
          <ToggleFacet
            bind:checked={$search_params.no_image}
            count={result_facets.has_image.values.false}
            label={$page.data.t('entry.does_not_exist') + ' ' + $page.data.t('entry.image')} />
        {/if}
      {/if}
      {#if result_facets?.has_audio?.values.true}
        <ToggleFacet
          bind:checked={$search_params.has_audio}
          count={result_facets.has_audio.values.true}
          label={$page.data.t('entry.has_exists') + ' ' + $page.data.t('entry_field.audio')} />
      {/if}
      {#if result_facets?.has_audio?.values.false}
        <ToggleFacet
          bind:checked={$search_params.no_audio}
          count={result_facets.has_audio.values.false}
          label={$page.data.t('entry.does_not_exist') + ' ' + $page.data.t('entry_field.audio')} />
      {/if}
      {#if result_facets?.has_video?.values.true}
        <ToggleFacet
          bind:checked={$search_params.has_video}
          count={result_facets.has_video.values.true}
          label={$page.data.t('entry.has_exists') + ' ' + $page.data.t('entry_field.video')} />
      {/if}
      {#if result_facets?.has_video?.values.false}
        <ToggleFacet
          bind:checked={$search_params.no_video}
          count={result_facets.has_video.values.false}
          label={$page.data.t('entry.does_not_exist') + ' ' + $page.data.t('entry_field.video')} />
      {/if}

      <pre>{JSON.stringify($search_params, null, 2)}</pre>

      <!-- label={$page.data.t('entry.has_exists') + ' ' + $page.data.t('entry_field.speaker')} />
      label={$page.data.t('entry.does_not_exist') + ' ' + $page.data.t('entry_field.speaker')} />
      label={$page.data.t('entry.has_exists') + ' ' + $page.data.t('entry_field.noun_class')} />
      label={$page.data.t('entry.does_not_exist') + ' ' + $page.data.t('entry_field.noun_class')} />
      label={$page.data.t('entry.has_exists') + ' ' + $page.data.t('entry_field.plural_form')} />
      label={$page.data.t('entry.does_not_exist') + ' ' + $page.data.t('entry_field.plural_form')} />
      label={$page.data.t('entry.has_exists') + ' ' + $page.data.t('entry_field.parts_of_speech')} />
      label={$page.data.t('entry.does_not_exist') + ' ' + $page.data.t('entry_field.parts_of_speech')} />
      label={$page.data.t('entry.has_exists') + ' ' + $page.data.t('entry_field.semantic_domains')} />
      label={$page.data.t('entry.does_not_exist') + ' ' + $page.data.t('entry_field.semantic_domains')} /> -->
    </div>
  </section>
</ResponsiveSlideover>
