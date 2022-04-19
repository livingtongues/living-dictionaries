<script lang="ts">
  import type { Readable } from 'svelte/store';
  export let t: Readable<any> = undefined;
  import type { IDictionary, IGlossLanguages } from '@ld/types';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import ShowHide from 'svelte-pieces/functions/ShowHide.svelte';
  import BadgeArrayEmit from 'svelte-pieces/data/BadgeArrayEmit.svelte';
  import Modal from 'svelte-pieces/ui/Modal.svelte';
  import Filter from '../helpers/Filter.svelte';
  //import { admin } from '$lib/stores';
  export let admin = false;
  export let glossingLanguages: IGlossLanguages;
  export let dictionary: IDictionary;

  $: activeGlossingBcps = dictionary.glossLanguages.map((bcp) => $t('gl.' + bcp));
  $: remainingGlossingLanguagesAsArray = Object.entries(glossingLanguages)
    .map((e) => ({
      bcp: e[0],
      ...e[1],
    }))
    .filter((e) => !dictionary.glossLanguages.includes(e.bcp));

  import { createEventDispatcher } from 'svelte';
  const dispatch =
    createEventDispatcher<{ add: { languageId: string }; remove: { languageId: string } }>();
</script>

<div class="mt-6">
  <label for="glosses" class="block text-xs leading-5 text-gray-700 mb-1">
    {$t('create.gloss_dictionary_in', {
      default: 'Make dictionary available in...',
    })}
  </label>

  <ShowHide let:show let:toggle>
    <BadgeArrayEmit
      strings={activeGlossingBcps}
      canEdit
      addMessage={$t('misc.add', { default: 'Add' })}
      on:itemremoved={(e) => {
        if (admin) {
          if (
            confirm('Remove as admin? Know that regular editors get a message saying "Contact Us"')
          ) {
            dispatch('remove', { languageId: dictionary.glossLanguages[e.detail.index] });
          }
        } else {
          alert($t('header.contact_us', { default: 'Contact Us' }));
        }
      }}
      on:additem={toggle} />
    {#if show}
      <Modal on:close={toggle}>
        <span slot="heading">
          {$t('create.gloss_dictionary_in', {
            default: 'Make dictionary available in...',
          })}
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
              {language.vernacularName || $t('gl.' + language.bcp)}
              {#if language.vernacularAlternate}
                {language.vernacularAlternate}
              {/if}
              {#if language.vernacularName}
                <small>({$t('gl.' + language.bcp)})</small>
              {/if}
            </Button>
          {/each}

          <div class="modal-footer space-x-1">
            <Button onclick={toggle} color="black">Cancel</Button>
          </div>
        </Filter>
      </Modal>
    {/if}
  </ShowHide>

  <div class="text-xs text-gray-600 mt-1">
    {$t('create.gloss_dictionary_clarification', {
      default: 'Language(s) you want to translate entries into',
    })}
    {$t('settings.unable-deleting-msg', {
      default: 'Note: you will not be able to delete these glossing languages later.',
    })}
  </div>
</div>