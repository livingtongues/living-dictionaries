<script lang="ts">
  import { t } from 'svelte-i18n';
  import { page } from '$app/stores';
  import RefinementList from '$lib/components/search/RefinementList.svelte';
  import ToggleRefinement from '$lib/components/search/ToggleRefinement.svelte';
  import ClearRefinements from '$lib/components/search/ClearRefinements.svelte';
  import type { InstantSearch } from 'instantsearch.js';
  import { Button, ResponsiveSlideover } from 'svelte-pieces';

  export let showMobileFilters = false;
  export let search: InstantSearch;
</script>

<ResponsiveSlideover
  side={$t('direction') === 'rtl' ? 'left' : 'right'}
  showWidth={'md'}
  bind:open={showMobileFilters}>
  <section
    class="md:w-52 md:sticky md:top-24 md:max-h-[calc(100vh-107px)] print:hidden p-4 md:p-0 md:overflow-y-auto">
    <header class="flex items-center justify-between space-x-3">
      <h2 class="text-lg leading-7 font-medium text-gray-900 mb-3">
        {$t('entry.filters', { default: 'Filters' })}
      </h2>
      <ClearRefinements {search} />
      <Button onclick={() => (showMobileFilters = false)} size="sm" form="filled" class="md:hidden">
        {$t('entry.view_entries', { default: 'View Entries' })}
      </Button>
    </header>
    <div class="relative flex-1 overflow-y-auto">
      <RefinementList
        {search}
        attribute="ps"
        label={$t('entry.ps', { default: 'Parts of Speech' })} />
      <RefinementList
        {search}
        attribute="sdn"
        label={$t('entry.sdn', { default: 'Semantic Domains' })} />
      <RefinementList {search} attribute="di" label={$t('entry.di', { default: 'Dialect' })} />
      <RefinementList
        {search}
        attribute="sf.speakerName"
        label={$t('entry.speaker', { default: 'Speaker' })} />
      <hr />

      {#if !$page.url.pathname.includes('gallery')}
        <ToggleRefinement
          {search}
          attribute="hasImage"
          label={$t('entry.has_exists', {
            default: 'Has',
          }) +
            ' ' +
            $t('entry.image', { default: 'Image' })} />
      {/if}
      <ToggleRefinement
        {search}
        attribute="hasAudio"
        label={$t('entry.has_exists', {
          default: 'Has',
        }) +
          ' ' +
          $t('entry.audio', { default: 'Audio' })} />
      <ToggleRefinement
        {search}
        attribute="hasSpeaker"
        label={$t('entry.has_exists', {
          default: 'Has',
        }) +
          ' ' +
          $t('entry.speaker', { default: 'Speaker' })} />
      <ToggleRefinement
        {search}
        attribute="hasNounClass"
        label={$t('entry.has_exists', {
          default: 'Has',
        }) +
          ' ' +
          $t('entry.nc', { default: 'Noun Class' })} />
      <ToggleRefinement
        {search}
        attribute="hasPluralForm"
        label={$t('entry.has_exists', {
          default: 'Has',
        }) +
          ' ' +
          $t('entry.pl', { default: 'Plural Form' })} />
      <ToggleRefinement
        {search}
        attribute="hasPartOfSpeech"
        label={$t('entry.has_exists', {
          default: 'Has',
        }) +
          ' ' +
          $t('entry.ps', { default: 'Part of Speech' })} />
      <ToggleRefinement
        {search}
        attribute="hasSemanticDomain"
        label={$t('entry.has_exists', {
          default: 'Has',
        }) +
          ' ' +
          $t('entry.sdn', { default: 'Semantic Domain' })} />
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

<!-- {#if $isManager}
    <ToggleRefinement
      {search}
      attribute="hasImage"
      on={false}
      label={$t('entry.does_not_exist', {
        default: 'No',
      }) + ' ' + $t('entry.image', { default: 'Image' })} />
    <hr />
  {/if}
   {#if $isManager}
  <ToggleRefinement
    {search}
    attribute="hasAudio"
    on={false}
    label={$t('entry.does_not_exist', {
      default: 'No',
    }) + ' ' + $t('entry.audio', { default: 'Audio' })} />
{/if}
 {#if $isManager}
  <ToggleRefinement
    {search}
    attribute="hasSpeaker"
    on={false}
    label={$t('entry.does_not_exist', {
      default: 'No',
    }) + ' ' + $t('entry.speaker', { default: 'Speaker' })} />
  <hr />
{/if}
 {#if $isManager}
  <ToggleRefinement
    {search}
    attribute="hasPartOfSpeech"
    on={false}
    label={$t('entry.does_not_exist', {
      default: 'No',
    }) + ' ' + $t('entry.ps', { default: 'Part of Speech' })} />
  <hr />
{/if}
 {#if $isManager}
  <ToggleRefinement
    {search}
    attribute="hasSemanticDomain"
    on={false}
    label={$t('entry.does_not_exist', {
      default: 'No',
    }) + ' ' + $t('entry.sdn', {
        default: 'Semantic Domain',
      })} />
{/if} -->
