<script lang="ts">
  import { t } from 'svelte-i18n';
  import type { IGlossLanguages } from '@living-dictionaries/types';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import ShowHide from 'svelte-pieces/functions/ShowHide.svelte';
  import BadgeArrayEmit from 'svelte-pieces/data/BadgeArrayEmit.svelte';
  import Modal from 'svelte-pieces/ui/Modal.svelte';
  import Filter from '$lib/components/Filter.svelte';

  export let availableLanguages: IGlossLanguages;
  export let selectedLanguages: string[];

  export let minimum = 1;

  $: activeGlossingBcps = Array.isArray(selectedLanguages)
    ? selectedLanguages.map((bcp) => (t ? $t('gl.' + bcp) : availableLanguages[bcp].vernacularName))
    : [];
  $: remainingGlossingLanguagesAsArray = Object.entries(availableLanguages)
    .map((e) => ({
      bcp: e[0],
      ...e[1],
    }))
    .filter((e) => !selectedLanguages.includes(e.bcp));

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{
    add: { languageId: string };
    remove: { languageId: string; index: number };
  }>();
</script>

<div class="text-sm font-medium text-gray-700 mb-1">
  {$t('create.gloss_dictionary_in', { default: 'Make dictionary available in...' })}
</div>

<ShowHide let:show let:toggle>
  <BadgeArrayEmit
    strings={activeGlossingBcps}
    {minimum}
    canEdit
    addMessage={t ? $t('misc.add', { default: 'Add' }) : 'Add'}
    on:itemremoved={(e) => {
      dispatch('remove', {
        languageId: selectedLanguages[e.detail.index],
        index: e.detail.index,
      });
    }}
    on:additem={toggle} />
  {#if show}
    <Modal on:close={toggle}>
      <span slot="heading">
        {$t('create.gloss_dictionary_in', { default: 'Make dictionary available in...' })}
      </span>
      <Filter
        items={remainingGlossingLanguagesAsArray}
        let:filteredItems={filteredLanguages}
        placeholder={$t('about.search', { default: 'Search' })}>
        {#each filteredLanguages as language}
          <Button
            onclick={() => {
              dispatch('add', { languageId: language.bcp });
              toggle();
            }}
            color="green"
            form="simple"
            class="w-full !text-left">
            {language.vernacularName || $t('gl.' + language.bcp, { default: language.bcp })}
            {#if language.vernacularAlternate}
              {language.vernacularAlternate}
            {/if}
            {#if language.vernacularName && t}
              <small>({$t('gl.' + language.bcp, { default: language.bcp })})</small>
            {/if}
          </Button>
        {/each}
      </Filter>
      <div class="modal-footer">
        <Button onclick={toggle} color="black">Cancel</Button>
      </div>
    </Modal>
  {/if}
</ShowHide>

<div class="text-xs text-gray-600 mt-1">
  {$t('create.gloss_dictionary_clarification', {
    default: 'Language(s) you want to translate entries into',
  })}.
  {$t('settings.unable_to_delete', {
    default: 'Note: you will not be able to delete these glossing languages later.',
  })}
</div>