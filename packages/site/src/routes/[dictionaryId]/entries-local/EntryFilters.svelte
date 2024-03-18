<script lang="ts">
  import { page } from '$app/stores';
  import { Button, ResponsiveSlideover } from 'svelte-pieces';

  export let show_mobile_filters = false;
  export let on_close: () => void
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
      <!-- <ClearRefinements {search} /> -->
      <Button onclick={on_close} size="sm" form="filled" class="md:hidden">
        {$page.data.t('entry.view_entries')}
      </Button>
    </header>
    <div class="relative flex-1 overflow-y-auto">
      <!-- <RefinementList
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
        label={$page.data.t('entry_field.speaker')} /> -->
      <hr />

      {#if !$page.url.pathname.includes('gallery')}
        <!-- <ToggleRefinement
              {search}
              attribute="hasImage"
              label={$page.data.t('entry.has_exists') + ' ' + $page.data.t('entry.image')} /> -->
        <!-- <ToggleRefinement
              {search}
              attribute="hasImage"
              on={false}
              label={$page.data.t('entry.does_not_exist') + ' ' + $page.data.t('entry.image')} /> -->
      {/if}
      <!-- <ToggleRefinement
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
            label={$page.data.t('entry.does_not_exist') + ' ' + $page.data.t('entry_field.semantic_domains')} /> -->


      <!-- <ToggleRefinement
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
            label={$page.data.t('entry.has_exists') + ' ' + $page.data.t('entry_field.semantic_domains')} /> -->
    </div>
  </section>
</ResponsiveSlideover>
