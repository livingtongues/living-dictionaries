<script lang="ts">
  import { page } from '$app/stores';
  import type { IGlossLanguages } from '@living-dictionaries/types';
  import { Button, ShowHide, BadgeArrayEmit, Modal } from 'svelte-pieces';
  import Filter from '$lib/components/Filter.svelte';

  export let availableLanguages: IGlossLanguages;
  export let selectedLanguages: string[];

  export let minimum = 1;

  $: activeGlossingBcps = Array.isArray(selectedLanguages)
    ? selectedLanguages.map((bcp) =>
      $page.data.t({ dynamicKey: 'gl.' + bcp, fallback: availableLanguages[bcp].vernacularName })
    )
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
  {$page.data.t('create.gloss_dictionary_in')}
</div>

<ShowHide let:show let:toggle>
  <BadgeArrayEmit
    strings={activeGlossingBcps}
    {minimum}
    canEdit
    addMessage={$page.data.t('misc.add')}
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
        {$page.data.t('create.gloss_dictionary_in')}
      </span>
      <Filter
        items={remainingGlossingLanguagesAsArray}
        let:filteredItems={filteredLanguages}
        placeholder={$page.data.t('about.search')}>
        {#each filteredLanguages as language}
          <Button
            onclick={() => {
              dispatch('add', { languageId: language.bcp });
              toggle();
            }}
            color="green"
            form="simple"
            class="w-full !text-left">
            {language.vernacularName || $page.data.t({ dynamicKey: 'gl.' + language.bcp, fallback: language.bcp })}
            {#if language.vernacularAlternate}
              {language.vernacularAlternate}
            {/if}
            {#if language.vernacularName}
              <small>({$page.data.t({ dynamicKey: 'gl.' + language.bcp, fallback: language.bcp })})</small>
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
  {$page.data.t('create.gloss_dictionary_clarification')}.
  {$page.data.t('settings.unable_to_delete')}
</div>
