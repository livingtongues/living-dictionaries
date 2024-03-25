<script lang="ts">
  import { page } from '$app/stores';
  import RefinementList from '$lib/components/search/RefinementList.svelte';
  import ToggleRefinement from '$lib/components/search/ToggleRefinement.svelte';
  import ClearRefinements from '$lib/components/search/ClearRefinements.svelte';
  import type { InstantSearch } from 'instantsearch.js';
  import { Button, ResponsiveSlideover, ShowHide } from 'svelte-pieces';

  export let showMobileFilters = false;
  export let search: InstantSearch;
  $: ({is_manager} = $page.data)
</script>

<ResponsiveSlideover
  side={$page.data.t('page.direction') === 'rtl' ? 'left' : 'right'}
  showWidth={'md'}
  bind:open={showMobileFilters}>
  <section
    class="md:w-52 md:sticky md:top-24 md:max-h-[calc(100vh-107px)] print:hidden p-4 md:p-0 md:overflow-y-auto">
    <header class="flex items-center justify-between space-x-3">
      <h2 class="text-lg leading-7 font-medium text-gray-900 mb-3">
        {$page.data.t('entry.filters')}
      </h2>
      <ClearRefinements {search} />
      <Button onclick={() => (showMobileFilters = false)} size="sm" form="filled" class="md:hidden">
        {$page.data.t('entry.view_entries')}
      </Button>
    </header>
    <div class="relative flex-1 overflow-y-auto">
      <RefinementList
        {search}
        attribute="ps"
        label={$page.data.t('entry_field.parts_of_speech')} />
      <RefinementList
        {search}
        attribute="sdn"
        label={$page.data.t('entry_field.semantic_domains')} />
      <RefinementList {search} attribute="di" label={$page.data.t('entry_field.dialects')} />
      <RefinementList
        {search}
        attribute="sf.speakerName"
        label={$page.data.t('entry_field.speaker')} />
      <hr />

      <ShowHide let:show={show_negatives} let:toggle>
        {#if show_negatives}
          {#if !$page.url.pathname.includes('gallery')}
            <ToggleRefinement
              {search}
              attribute="hasImage"
              on={false}
              label={$page.data.t('entry.does_not_exist') + ' ' + $page.data.t('entry.image')} />
          {/if}
          <ToggleRefinement
            {search}
            attribute="hasAudio"
            on={false}
            label={$page.data.t('entry.does_not_exist') + ' ' + $page.data.t('entry_field.audio')} />
          <ToggleRefinement
            {search}
            attribute="hasSpeaker"
            on={false}
            label={$page.data.t('entry.does_not_exist') + ' ' + $page.data.t('entry_field.speaker')} />
          <ToggleRefinement
            {search}
            attribute="hasNounClass"
            on={false}
            label={$page.data.t('entry.does_not_exist') + ' ' + $page.data.t('entry_field.noun_class')} />
          <ToggleRefinement
            {search}
            attribute="hasPluralForm"
            on={false}
            label={$page.data.t('entry.does_not_exist') + ' ' + $page.data.t('entry_field.plural_form')} />
          <ToggleRefinement
            {search}
            attribute="hasPartOfSpeech"
            on={false}
            label={$page.data.t('entry.does_not_exist') + ' ' + $page.data.t('entry_field.parts_of_speech')} />
          <ToggleRefinement
            {search}
            attribute="hasSemanticDomain"
            on={false}
            label={$page.data.t('entry.does_not_exist') + ' ' + $page.data.t('entry_field.semantic_domains')} />
        {:else}
          {#if !$page.url.pathname.includes('gallery')}
            <ToggleRefinement
              {search}
              attribute="hasImage"
              label={$page.data.t('entry.has_exists') + ' ' + $page.data.t('entry.image')} />
          {/if}
          <ToggleRefinement
            {search}
            attribute="hasAudio"
            label={$page.data.t('entry.has_exists') + ' ' + $page.data.t('entry_field.audio')} />
          <ToggleRefinement
            {search}
            attribute="hasSpeaker"
            label={$page.data.t('entry.has_exists') + ' ' + $page.data.t('entry_field.speaker')} />
          <ToggleRefinement
            {search}
            attribute="hasNounClass"
            label={$page.data.t('entry.has_exists') + ' ' + $page.data.t('entry_field.noun_class')} />
          <ToggleRefinement
            {search}
            attribute="hasPluralForm"
            label={$page.data.t('entry.has_exists') + ' ' + $page.data.t('entry_field.plural_form')} />
          <ToggleRefinement
            {search}
            attribute="hasPartOfSpeech"
            label={$page.data.t('entry.has_exists') + ' ' + $page.data.t('entry_field.parts_of_speech')} />
          <ToggleRefinement
            {search}
            attribute="hasSemanticDomain"
            label={$page.data.t('entry.has_exists') + ' ' + $page.data.t('entry_field.semantic_domains')} />
        {/if}

        {#if $is_manager}
          <Button class="mb-1" size="sm" onclick={toggle}>{$page.data.t('entry.switch_opposite')}</Button>
        {/if}
      </ShowHide>
    </div>
    <a
      class="block mt-3 md:mb-3 ml-auto"
      href="https://www.algolia.com/?utm_source=instantsearch.js&utm_medium=website&utm_content=livingdictionaries.app&utm_campaign=poweredby"
      target="_blank"
      rel="noopener noreferrer">
      <img
        class="w-full"
        style="max-width: 145px;"
        src="/images/search-by-algolia-light-background.svg"
        alt="Search by Algolia" />
    </a>
  </section>
</ResponsiveSlideover>
