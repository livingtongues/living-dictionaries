<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { IDictionary, IGlossLanguages } from '$lib/interfaces';
  import Button from '$svelteui/ui/Button.svelte';
  import ShowHide from '$svelteui/functions/ShowHide.svelte';
  import BadgeArrayEmit from '$svelteui/data/BadgeArrayEmit.svelte';
  import Modal from '$lib/components/ui/Modal.svelte';
  import Filter from '../admin/_Filter.svelte';

  export let glossingLanguages: IGlossLanguages;
  export let dictionary: IDictionary;

  $: activeGlossingBcps = dictionary.glossLanguages.map((bcp) => $_('gl.' + bcp));
  $: remainingGlossingLanguagesAsArray = Object.entries(glossingLanguages)
    .map((e) => ({
      bcp: e[0],
      ...e[1],
    }))
    .filter((e) => !dictionary.glossLanguages.includes(e.bcp));

  import { createEventDispatcher } from 'svelte';
  import { admin } from '$lib/stores';
  const dispatch =
    createEventDispatcher<{ add: { languageId: string }; remove: { languageId: string } }>();
</script>

<div class="mt-6">
  <label for="glosses" class="block text-xs leading-5 text-gray-700 mb-1">
    {$_('create.gloss_dictionary_in', {
      default: 'Make dictionary available in...',
    })}
  </label>

  <ShowHide let:show let:toggle>
    <BadgeArrayEmit
      strings={activeGlossingBcps}
      canEdit
      addMessage={$_('misc.add', { default: 'Add' })}
      on:itemremoved={(e) => {
        if ($admin) {
          if (
            confirm('Remove as admin? Know that regular editors get a message saying "Contact Us"')
          ) {
            dispatch('remove', { languageId: dictionary.glossLanguages[e.detail.index] });
          }
        } else {
          alert($_('header.contact_us', { default: 'Contact Us' }));
        }
      }}
      on:additem={toggle} />
    {#if show}
      <Modal on:close={toggle}>
        <span slot="heading">
          {$_('create.gloss_dictionary_in', {
            default: 'Make dictionary available in...',
          })}
        </span>
        <Filter
          items={remainingGlossingLanguagesAsArray}
          let:filteredItems={filteredLanguages}
          placeholder={$_('about.search', { default: 'Search' })}>
          {#each filteredLanguages as language}
            <Button
              onclick={() => {
                dispatch('add', { languageId: language.bcp });
                toggle();
              }}
              color="green"
              form="simple"
              class="w-full !text-left">
              {language.vernacularName || $_('gl.' + language.bcp)}
              {#if language.vernacularAlternate}
                {language.vernacularAlternate}
              {/if}
              {#if language.vernacularName}
                <small>({$_('gl.' + language.bcp)})</small>
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
    {$_('create.gloss_dictionary_clarification', {
      default: 'Language(s) you want to translate entries into',
    })}
    {$_('settings.unable-deleting-msg', {
      default: 'Note: you will not be able to delete these glossing languages later.',
    })}
  </div>
</div>
