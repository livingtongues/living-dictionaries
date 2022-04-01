<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { page } from '$app/stores';
  import RefinementList from '$lib/components/search/RefinementList.svelte';
  import ToggleRefinement from '$lib/components/search/ToggleRefinement.svelte';
  import ClearRefinements from '$lib/components/search/ClearRefinements.svelte';
  import type { InstantSearch } from 'instantsearch.js';
  import Button from 'svelte-pieces/ui/Button.svelte';
  export let showMobileFilters = false,
    search: InstantSearch;
</script>

<div
  class:hide-backdrop={!showMobileFilters}
  class="backdrop"
  on:click={() => (showMobileFilters = false)} />

<section
  class="{showMobileFilters
    ? 'translate-x-0'
    : 'ltr:translate-x-full rtl:-translate-x-full'} menu ltr:right-0 rtl:left-0">
  <header class="flex items-center justify-between space-x-3">
    <h2 class="text-lg leading-7 font-medium text-gray-900">
      {$_('entry.filters', { default: 'Filters' })}
    </h2>
    <ClearRefinements {search} />
    <Button onclick={() => (showMobileFilters = false)} size="sm" form="primary" class="md:hidden">
      {$_('entry.view_entries', { default: 'View Entries' })}
    </Button>
  </header>
  <div class="relative flex-1 overflow-y-auto">
    <RefinementList
      {search}
      attribute="ps"
      label={$_('entry.ps', { default: 'Parts of Speech' })} />
    <RefinementList
      {search}
      attribute="sdn"
      label={$_('entry.sdn', { default: 'Semantic Domains' })} />
    <RefinementList
      {search}
      attribute="sf.speakerName"
      label={$_('entry.speaker', { default: 'Speaker' })} />
    <hr />

    {#if !$page.path.includes('gallery')}
      <ToggleRefinement
        {search}
        attribute="hasImage"
        label={$_('entry.has_exists', {
          default: 'Has',
        }) +
          ' ' +
          $_('entry.image', { default: 'Image' })} />
    {/if}
    <ToggleRefinement
      {search}
      attribute="hasAudio"
      label={$_('entry.has_exists', {
        default: 'Has',
      }) +
        ' ' +
        $_('entry.audio', { default: 'Audio' })} />
    <ToggleRefinement
      {search}
      attribute="hasSpeaker"
      label={$_('entry.has_exists', {
        default: 'Has',
      }) +
        ' ' +
        $_('entry.speaker', { default: 'Speaker' })} />
    <ToggleRefinement
      {search}
      attribute="hasPartOfSpeech"
      label={$_('entry.has_exists', {
        default: 'Has',
      }) +
        ' ' +
        $_('entry.ps', { default: 'Part of Speech' })} />
    <ToggleRefinement
      {search}
      attribute="hasSemanticDomain"
      label={$_('entry.has_exists', {
        default: 'Has',
      }) +
        ' ' +
        $_('entry.sdn', { default: 'Semantic Domain' })} />
  </div>
  <a
    class="block mt-3 md:mb-3 ml-auto"
    href="https://www.algolia.com/?utm_source=instantsearch.js&utm_medium=website&utm_content=livingdictionaries.app&utm_campaign=poweredby"
    target="_blank">
    <img
      class="w-full"
      style="max-width: 145px;"
      src="/images/search-by-algolia-light-background.svg"
      alt="Search by Algolia" />
  </a>
</section>

<!-- {#if $isManager}
    <ToggleRefinement
      {search}
      attribute="hasImage"
      on={false}
      label={$_('entry.does_not_exist', {
        default: 'No',
      }) + ' ' + $_('entry.image', { default: 'Image' })} />
    <hr />
  {/if} 
   {#if $isManager}
  <ToggleRefinement
    {search}
    attribute="hasAudio"
    on={false}
    label={$_('entry.does_not_exist', {
      default: 'No',
    }) + ' ' + $_('entry.audio', { default: 'Audio' })} />
{/if} 
 {#if $isManager}
  <ToggleRefinement
    {search}
    attribute="hasSpeaker"
    on={false}
    label={$_('entry.does_not_exist', {
      default: 'No',
    }) + ' ' + $_('entry.speaker', { default: 'Speaker' })} />
  <hr />
{/if}
 {#if $isManager}
  <ToggleRefinement
    {search}
    attribute="hasPartOfSpeech"
    on={false}
    label={$_('entry.does_not_exist', {
      default: 'No',
    }) + ' ' + $_('entry.ps', { default: 'Part of Speech' })} />
  <hr />
{/if} 
 {#if $isManager}
  <ToggleRefinement
    {search}
    attribute="hasSemanticDomain"
    on={false}
    label={$_('entry.does_not_exist', {
      default: 'No',
    }) + ' ' + $_('entry.sdn', {
        default: 'Semantic Domain',
      })} />
{/if} -->
<style>
  .menu {
    @apply overflow-y-auto w-64 md:w-52 
    inset-y-0  
    flex 
    z-50 md:z-auto
    fixed md:sticky md:top-24 
    self-start flex-shrink-0 flex-col p-4 md:p-0
    bg-white shadow-lg md:shadow-none 
    transform transition-transform ease-in-out duration-300 
    md:max-h-[calc(100vh-107px)];
    /* md:!transform-none - won't work until https://github.com/tailwindlabs/tailwindcss/issues/4823 is fixed, see temp solution below */
  }

  @media (min-width: 768px) {
    .menu {
      transform: none !important;
    }
  }

  .backdrop {
    @apply fixed inset-0 bg-gray-900 bg-opacity-25 z-40 transition-opacity duration-300;
  }
  .hide-backdrop {
    @apply opacity-0 pointer-events-none;
  }
</style>
