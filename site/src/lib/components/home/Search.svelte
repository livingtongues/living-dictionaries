<script lang="ts">
  import type { DictionaryView, IPoint } from '$lib/types'
  import Button from '$lib/components/ui/Button.svelte'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import { page } from '$app/state'
  import IconCarbonSearch from '~icons/carbon/search'
  import IconLaTimes from '~icons/la/times'
  import IconFa6SolidChevronLeft from '~icons/fa6-solid/chevron-left'

  interface Props {
    dictionaries?: DictionaryView[]
    my_dictionaries?: DictionaryView[]
    selectedDictionaryId: string
    on_selected_dictionary_point: (point: IPoint) => void
  }

  let {
    dictionaries = [],
    my_dictionaries = [],
    selectedDictionaryId = $bindable(),
    on_selected_dictionary_point,
  }: Props = $props()

  const currentDictionary: DictionaryView = $derived(
    selectedDictionaryId
      ? dictionaries.find(dictionary => selectedDictionaryId === dictionary.id)
      : null,
  )

  let searchFocused = $state(false)
  let searchString = $state('')

  const filteredDictionaries: DictionaryView[] = $derived(dictionaries
    .filter((dictionary) => {
      return Object.keys(dictionary).some((k) => {
        return (
          typeof dictionary[k] === 'string'
          && dictionary[k].toLowerCase().includes(searchString.toLowerCase())
        )
      })
    })
    .reduce((acc, dictionary) => {
      return acc.find(e => e.id === dictionary.id) ? [...acc] : [...acc, dictionary]
    }, []))

  let searchBlurTimeout
  function delayedSearchClose() {
    searchBlurTimeout = setTimeout(() => {
      searchFocused = false
    }, 200)
  }

  function keepSearchOpen() {
    clearTimeout(searchBlurTimeout)
  }

  function setCurrentDictionary(dictionary: DictionaryView) {
    selectedDictionaryId = dictionary.id
    if (dictionary.coordinates?.points?.[0])
      on_selected_dictionary_point(dictionary.coordinates.points[0])
    searchString = ''
  }

  function clearDictionary() {
    selectedDictionaryId = null
  }
</script>

<!-- To Consider: for longer dictionaries on mobile, if we want to make the map still show when showing dictionary details, we need to add a media query (less than md) which sets this div's max-height: 75vh and adds overflow-y-auto -->

<div class="search-root">
  {#if !currentDictionary}
    <div class="search-box">
      <div class="search-icon">
        <IconCarbonSearch class="icon-inline" />
      </div>
      <input
        type="text"
        bind:value={searchString}
        placeholder={page.data.t('home.find_dictionary')}
        onfocus={() => (searchFocused = true)}
        onblur={delayedSearchClose} />
      {#if searchString || searchFocused}
        <button type="button" onclick={() => (searchString = '')} class="clear-button">
          <IconLaTimes class="icon-inline" style="color: color-mix(in srgb, var(--color) 45%, var(--background))" />
        </button>
      {/if}
    </div>

    <div onclick={keepSearchOpen}>
      {#if searchString}
        <div class="result-count">
          <i> {filteredDictionaries.length}/{dictionaries.length} </i>
        </div>
      {/if}

      {#if !searchString && my_dictionaries?.length}
        <!-- <div class="text-sm font-semibold px-3 my-1">
          {page.data.t('home.my_dictionaries')}
        </div> -->
        <!-- {#each my_dictionaries as dictionary}
          <button
            type="button"
            class="text-left px-3 py-1 my-1 hover:bg-gray-200"
            onclick={() => setCurrentDictionary(dictionary)}>
            <div>{dictionary.name}</div>
            {#if dictionary.location}
              <small class="-mt-1 text-gray-600">{dictionary.location}</small>
            {/if}
          </button>
        {/each} -->
        <!-- <hr class="my-2" />
        <div class="text-sm font-semibold px-3 my-1">
          {page.data.t('home.public_dictionaries')}
          {#if admin}
            (+ Private)
          {/if}
        </div> -->
      {/if}

      <!-- {#each filteredDictionaries as dictionary}
        <button
          type="button"
          class="text-left px-3 py-1 my-1 hover:bg-gray-200"
          onclick={() => setCurrentDictionary(dictionary)}>
          <div>{dictionary?.name}</div>
          {#if dictionary.location}
            <small class="-mt-1 text-gray-600">{dictionary.location}</small>
          {/if}
        </button>
      {/each} -->
      {#if !filteredDictionaries.length}
        <div style="padding: 0.75rem">
          <i> {page.data.t('home.no_results')} </i>
        </div>
      {/if}
    </div>

    <div class="dict-buttons">
      <ShowHide>
        {#snippet children({ show, toggle })}
          {#if !searchFocused && my_dictionaries}
            {#each my_dictionaries as dictionary, i (dictionary.id)}
              {#if show || i < 3}
                <Button
                  class="dict-button"
                  color="black"
                  onclick={() => setCurrentDictionary(dictionary)}>
                  {dictionary?.name}
                </Button>
              {/if}
            {/each}
          {/if}
        {/snippet}
      </ShowHide>
    </div>
  {:else}
    <div class="selected-pane">
      <button
        type="button"
        class="back-button"
        onclick={clearDictionary}>
        <IconFa6SolidChevronLeft class="icon-inline rtl-x-flip" />
        <div style="width: 0.25rem"></div>
        {page.data.t('misc.back')}
      </button>
      {#await import('./SelectedDict.svelte') then { default: SelectedDict }}
        <SelectedDict dictionary={currentDictionary} />
      {/await}
    </div>
  {/if}
</div>

<style>
  .search-root {
    display: flex;
    flex-direction: column;
  }

  .search-box {
    position: relative;
    font-size: 1.25rem;
    line-height: 1.75rem;
    margin-top: 0.5rem;
  }

  @media (min-width: 640px) {
    .search-root {
      width: 18rem;
    }

    .search-box {
      margin-bottom: 0.5rem;
    }
  }

  .search-icon {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    padding-left: 1.25rem;
    display: flex;
    align-items: center;
    pointer-events: none;
    color: var(--color-secondary); /* ≈ gray-500 */
  }

  /* placeholder color comes from the forms preflight (gray-500) */
  .search-box input {
    width: 100%;
    padding: 0.25rem 2rem 0.25rem 2.5rem;
    border-radius: 0.5rem;
    color: var(--color);
    box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
  }

  .clear-button {
    position: absolute;
    top: 0;
    bottom: 0;
    right: 0;
    padding: 0 1rem;
    display: flex;
    align-items: center;
  }

  .clear-button:focus {
    outline: 2px solid transparent;
    outline-offset: 2px;
  }

  .result-count {
    font-size: 0.875rem;
    line-height: 1.25rem;
    color: var(--color-secondary); /* ≈ gray-500 */
    padding: 0 0.75rem;
    margin: 0.25rem 0;
  }

  .dict-buttons {
    display: flex;
    flex-wrap: wrap;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0 0.5rem 0.5rem;
  }

  @media (min-width: 640px) {
    .dict-buttons {
      flex-direction: column;
    }
  }

  .dict-buttons :global(.dict-button) {
    margin-bottom: 0.25rem;
    margin-right: 0.25rem;
  }

  .selected-pane {
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    flex: 1 1 0%;
  }

  .back-button {
    display: flex;
    align-items: center;
    padding: 0.5rem;
    margin-left: -0.25rem;
    margin-right: -0.25rem;
    border-radius: 0.25rem;
  }

  .back-button:hover {
    background-color: color-mix(in srgb, var(--background), var(--color) 10%); /* ≈ gray-200 */
  }
</style>
