<script lang="ts">
  import { run } from 'svelte/legacy';

  import type { DictionaryView, IPoint } from '@living-dictionaries/types'
  import { Button, ShowHide } from 'svelte-pieces'
  import { page } from '$app/stores'

  interface Props {
    dictionaries?: DictionaryView[];
    my_dictionaries?: DictionaryView[];
    selectedDictionaryId: string;
    on_selected_dictionary_point: (point: IPoint) => void;
  }

  let {
    dictionaries = [],
    my_dictionaries = [],
    selectedDictionaryId = $bindable(),
    on_selected_dictionary_point
  }: Props = $props();

  let currentDictionary: DictionaryView = $state()
  let { admin } = $derived($page.data)

  run(() => {
    if (selectedDictionaryId) {
      currentDictionary = dictionaries.find((dictionary) => {
        return selectedDictionaryId === dictionary.id
      })
    } else {
      currentDictionary = null
    }
  });

  let searchFocused = $state(false)
  let searchString = $state('')

  let filteredDictionaries: DictionaryView[] = $state([])
  run(() => {
    filteredDictionaries = dictionaries
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
      }, [])
  });

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

<div class="flex flex-col sm:w-72">
  {#if !currentDictionary}
    <div class="relative text-xl mt-2 sm:mb-2">
      <div
        class="absolute inset-y-0 left-0 pl-5 flex items-center
          pointer-events-none text-gray-500">
        <span class="i-carbon-search"></span>
      </div>
      <input
        type="text"
        bind:value={searchString}
        class="form-input w-full pl-10 pr-8 py-1 rounded-lg
          text-gray-900 placeholder-gray-500 shadow"
        placeholder={$page.data.t('home.find_dictionary')}
        onfocus={() => (searchFocused = true)}
        onblur={delayedSearchClose} />
      {#if searchString || searchFocused}
        <button type="button" onclick={() => (searchString = '')} class="absolute inset-y-0 right-0 px-4 flex items-center focus:outline-none">
          <span class="i-la-times text-gray-400"></span>
        </button>
      {/if}
    </div>

    <div onclick={keepSearchOpen}>
      {#if searchString}
        <div class="text-sm text-gray-500 px-3 my-1">
          <i> {filteredDictionaries.length}/{dictionaries.length} </i>
        </div>
      {/if}

      {#if !searchString && my_dictionaries?.length}
        <!-- <div class="text-sm font-semibold px-3 my-1">
          {$page.data.t('home.my_dictionaries')}
        </div> -->
        <!-- {#each my_dictionaries as dictionary}
          <button
            type="button"
            class="text-left px-3 py-1 my-1 hover:bg-gray-200"
            on:click={() => setCurrentDictionary(dictionary)}>
            <div>{dictionary.name}</div>
            {#if dictionary.location}
              <small class="-mt-1 text-gray-600">{dictionary.location}</small>
            {/if}
          </button>
        {/each} -->
        <!-- <hr class="my-2" />
        <div class="text-sm font-semibold px-3 my-1">
          {$page.data.t('home.public_dictionaries')}
          {#if $admin}
            (+ Private)
          {/if}
        </div> -->
      {/if}

      <!-- {#each filteredDictionaries as dictionary}
        <button
          type="button"
          class="text-left px-3 py-1 my-1 hover:bg-gray-200"
          on:click={() => setCurrentDictionary(dictionary)}>
          <div>{dictionary?.name}</div>
          {#if dictionary.location}
            <small class="-mt-1 text-gray-600">{dictionary.location}</small>
          {/if}
        </button>
      {/each} -->
      {#if !filteredDictionaries.length}
        <div class="p-3">
          <i> {$page.data.t('home.no_results')} </i>
        </div>
      {/if}
    </div>

    <div
      class="flex flex-wrap sm:flex-col overflow-y-auto
        overflow-x-hidden px-2 pb-2">
      <ShowHide  >
        {#snippet children({ show, toggle })}
                {#if !searchFocused && my_dictionaries}
            {#each my_dictionaries as dictionary, i}
              {#if show || i < 3}
                <Button
                  class="mb-1 mr-1"
                  color="black"
                  on:click={() => setCurrentDictionary(dictionary)}>
                  {dictionary?.name}
                </Button>
              {/if}
            {/each}
            <!-- {#if my_dictionaries.length > 3 && !show}
              <button
                type="button"
                class="sm:hidden rounded px-3 py-2 bg-white mt-2"
                on:click={toggle}>
                {$page.data.t('home.show_all_my_dictionaries')}
              </button>
              <div class="w-2 sm:hidden" />
            {/if} -->
          {/if}
                      {/snippet}
            </ShowHide>
    </div>
  {:else}
    <div class="p-2 flex flex-col flex-1">
      <button
        type="button"
        class="flex flex-start items-center px-2 py-2 -mx-1 rounded hover:bg-gray-200"
        onclick={clearDictionary}>
        <span class="i-fa6-solid-chevron-left rtl-x-flip"></span>
        <div class="w-1"></div>
        {$page.data.t('misc.back')}
      </button>
      {#await import('./SelectedDict.svelte') then { default: SelectedDict }}
        <SelectedDict dictionary={currentDictionary} />
      {/await}
    </div>
  {/if}
</div>
