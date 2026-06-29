<script lang="ts">
  import type { IGlossLanguages } from '$lib/types'
  import { BadgeArrayEmit, Button, Modal, ShowHide } from '$lib/svelte-pieces'
  import { page } from '$app/stores'
  import Filter from '$lib/components/Filter.svelte'

  interface Props {
    availableLanguages: IGlossLanguages
    selectedLanguages: string[]
    minimum?: number
    add_language: (languageId: string) => void
    remove_language: (languageId: string) => void
  }

  const {
    availableLanguages,
    selectedLanguages,
    minimum = 1,
    add_language,
    remove_language,
  }: Props = $props()

  const activeGlossingBcps = $derived(Array.isArray(selectedLanguages)
    ? selectedLanguages.map(bcp =>
      $page.data.t({ dynamicKey: `gl.${bcp}`, fallback: availableLanguages[bcp].vernacularName }),
    )
    : [])
  const remainingGlossingLanguagesAsArray = $derived(Object.entries(availableLanguages)
    .map(e => ({
      bcp: e[0],
      ...e[1],
      localizedName: $page.data.t({ dynamicKey: `gl.${e[0]}`, fallback: e[0] }),
    }))
    .filter(e => !selectedLanguages.includes(e.bcp)))
</script>

<div class="section-title">
  {$page.data.t('create.gloss_dictionary_in')}
</div>

<ShowHide>
  {#snippet children({ show, toggle })}
    <BadgeArrayEmit
      strings={activeGlossingBcps}
      {minimum}
      canEdit
      addMessage={$page.data.t('misc.add')}
      on_itemremoved={({ index }) => remove_language(selectedLanguages[index])}
      on_additem={toggle} />
    {#if show}
      <Modal on:close={toggle}>
        {#snippet heading()}
          <span>
            {$page.data.t('create.gloss_dictionary_in')}
          </span>
        {/snippet}
        <Filter
          items={remainingGlossingLanguagesAsArray}

          placeholder={$page.data.t('about.search')}>
          {#snippet children({ filteredItems: filteredLanguages })}
            {#each filteredLanguages as language (language.bcp)}
              <Button
                onclick={() => {
                  add_language(language.bcp)
                  toggle()
                }}
                color="green"
                form="simple"
                class="language-option">
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

<div class="hint">
  {$page.data.t('create.gloss_dictionary_clarification')}
  {$page.data.t('settings.unable_to_delete')}
</div>

<style>
  .section-title {
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 500;
    color: color-mix(in srgb, var(--color) 85%, var(--background)); /* ≈ gray-700 */
    margin-bottom: 0.25rem;
  }

  :global(.language-option) {
    width: 100%;
    text-align: left !important;
  }

  .hint {
    font-size: 0.75rem;
    line-height: 1rem;
    color: color-mix(in srgb, var(--color) 75%, var(--background)); /* ≈ gray-600 */
    margin-top: 0.25rem;
  }
</style>
