<script lang="ts">
  import type { Readable } from 'svelte/store';
  export let t: Readable<any> = undefined;

  import type { IGlossLanguages } from '@ld/types';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import ShowHide from 'svelte-pieces/functions/ShowHide.svelte';
  import BadgeArrayEmit from 'svelte-pieces/data/BadgeArrayEmit.svelte';
  import Modal from 'svelte-pieces/ui/Modal.svelte';
  import Filter from '../helpers/Filter.svelte';
  export let admin = false;
  export let glossingLanguages: IGlossLanguages;
  export let glossLanguages: string[];

  $: activeGlossingBcps = glossLanguages.map((bcp) => t ? $t('gl.' + bcp) : bcp);
  $: remainingGlossingLanguagesAsArray = Object.entries(glossingLanguages)
    .map((e) => ({
      bcp: e[0],
      ...e[1],
    }))
    .filter((e) => !glossLanguages.includes(e.bcp));

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{
    add: { languageId: string };
    remove: { languageId: string };
  }>();
</script>

<div class="mt-6">
  <label for="glosses" class="block text-xs leading-5 text-gray-700 mb-1">
    {t ? $t('create.gloss_dictionary_in') : 'Make dictionary available in...'}
  </label>

  <ShowHide let:show let:toggle>
    <BadgeArrayEmit
      strings={activeGlossingBcps}
      canEdit
      addMessage={t ? $t('misc.add', { default: 'Add' }) : 'Add'}
      on:itemremoved={(e) => {
        if (admin) {
          if (
            confirm('Remove as admin? Know that regular editors get a message saying "Contact Us"')
          ) {
            dispatch('remove', { languageId: glossLanguages[e.detail.index] });
          }
        } else {
          alert($t('header.contact_us', { default: 'Contact Us' }));
        }
      }}
      on:additem={toggle} />
    {#if show}
      <Modal on:close={toggle}>
        <span slot="heading">
          {t ? $t('create.gloss_dictionary_in') : 'Make dictionary available in...'}
        </span>
        <Filter
          items={remainingGlossingLanguagesAsArray}
          let:filteredItems={filteredLanguages}
          placeholder={t ? $t('about.search') : 'Search'}>
          {#each filteredLanguages as language}
            <Button
              onclick={() => {
                dispatch('add', { languageId: language.bcp });
                toggle();
              }}
              color="green"
              form="simple"
              class="w-full !text-left">
              {language.vernacularName || (t && $t('gl.' + language.bcp))}
              {#if language.vernacularAlternate}
                {language.vernacularAlternate}
              {/if}
              {#if language.vernacularName && t}
                <small>({$t('gl.' + language.bcp)})</small>
              {/if}
            </Button>
          {/each}

          <div class="modal-footer">
            <Button onclick={toggle} color="black">Cancel</Button>
          </div>
        </Filter>
      </Modal>
    {/if}
  </ShowHide>

  <div class="text-xs text-gray-600 mt-1">
    {t
      ? $t('create.gloss_dictionary_clarification')
      : 'Language(s) you want to translate entries into'}
    {t
      ? $t('settings.unable-deleting-msg')
      : 'Note: you will not be able to delete these glossing languages later.'}
  </div>
</div>
