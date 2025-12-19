<script lang="ts">
  import type { IGlossLanguages } from '@living-dictionaries/types'
  import { BadgeArrayEmit, Button, Modal, ShowHide } from '$lib/svelte-pieces'
  import { page } from '$app/stores'
  import Filter from '$lib/components/Filter.svelte'

  interface Props {
    availableLanguages: IGlossLanguages;
    selectedLanguages: string[];
    minimum?: number;
    add_language: (languageId: string) => void;
    remove_language: (languageId: string) => void;
  }

  let {
    availableLanguages,
    selectedLanguages,
    minimum = 1,
    add_language,
    remove_language
  }: Props = $props();

  let activeGlossingBcps = $derived(Array.isArray(selectedLanguages)
    ? selectedLanguages.map(bcp =>
      $page.data.t({ dynamicKey: `gl.${bcp}`, fallback: availableLanguages[bcp].vernacularName }),
    )
    : [])
  let remainingGlossingLanguagesAsArray = $derived(Object.entries(availableLanguages)
    .map(e => ({
      bcp: e[0],
      ...e[1],
    }))
    .filter(e => !selectedLanguages.includes(e.bcp)))
</script>

<div class="text-sm font-medium text-gray-700 mb-1">
  {$page.data.t('create.gloss_dictionary_in')}
</div>

<ShowHide  >
  {#snippet children({ show, toggle })}
    <BadgeArrayEmit
      strings={activeGlossingBcps}
      {minimum}
      canEdit
      addMessage={$page.data.t('misc.add')}
      onitemremoved={({ index }) => remove_language(selectedLanguages[index])}
      onadditem={toggle} />
    {#if show}
      <Modal on_close={toggle}>
        {#snippet heading()}
            <span >
            {$page.data.t('create.gloss_dictionary_in')}
          </span>
          {/snippet}
        <Filter
          items={remainingGlossingLanguagesAsArray}
          
          placeholder={$page.data.t('about.search')}>
          {#snippet children({ filteredItems: filteredLanguages })}
                {#each filteredLanguages as language}
              <Button
                onclick={() => {
                  add_language(language.bcp)
                  toggle()
                }}
                color="green"
                form="simple"
                class="w-full !text-left">
                {language.vernacularName || $page.data.t({ dynamicKey: `gl.${language.bcp}`, fallback: language.bcp })}
                {#if language.vernacularAlternate}
                  {language.vernacularAlternate}
                {/if}
                {#if language.vernacularName}
                  <small>({$page.data.t({ dynamicKey: `gl.${language.bcp}`, fallback: language.bcp })})</small>
                {/if}
              </Button>
            {/each}
                        {/snippet}
            </Filter>
        <div class="modal-footer">
          <Button onclick={toggle} color="black">Cancel</Button>
        </div>
      </Modal>
    {/if}
  {/snippet}
</ShowHide>

<div class="text-xs text-gray-600 mt-1">
  {$page.data.t('create.gloss_dictionary_clarification')}
  {$page.data.t('settings.unable_to_delete')}
</div>
