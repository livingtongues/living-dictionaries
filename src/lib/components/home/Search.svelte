<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { IDictionary } from '$lib/interfaces';
  export let dictionaries: IDictionary[] = [];
  import { admin } from '$lib/stores';

  import { fly } from 'svelte/transition';
  import { myDictionaries } from '$lib/stores';

  import { getContext } from 'svelte';
  import { contextKey } from '$lib/components/home/key';
  import Button from '$svelteui/ui/Button.svelte';
  const { getMap } = getContext(contextKey);

  // export let defaultZoom;
  export let selectedDictionaryId: string;
  let currentDictionary: IDictionary;

  $: if (selectedDictionaryId) {
    currentDictionary = dictionaries.find((dictionary) => {
      return selectedDictionaryId === dictionary.id;
    });
  } else {
    currentDictionary = null;
  }

  let searchFocused = false;
  let searchString = '';

  let filteredDictionaries: IDictionary[] = [];
  $: {
    filteredDictionaries = dictionaries
      .filter((dictionary) => {
        return Object.keys(dictionary).some((k) => {
          return (
            typeof dictionary[k] === 'string' &&
            dictionary[k].toLowerCase().includes(searchString.toLowerCase())
          );
        });
      })
      .reduce((acc, dictionary) => {
        return acc.find((e) => e.id === dictionary.id) ? [...acc] : [...acc, dictionary];
      }, []);
  }

  let searchBlurTimeout;
  function delayedSearchClose() {
    searchBlurTimeout = setTimeout(() => {
      searchFocused = false;
    }, 200);
  }

  function keepSearchOpen() {
    clearTimeout(searchBlurTimeout);
  }

  function setCurrentDictionary(dictionary: IDictionary) {
    selectedDictionaryId = dictionary.id;
    searchString = '';
    if (dictionary.coordinates) {
      const map = getMap();
      map.setZoom(7);
      map.setCenter([dictionary.coordinates.longitude, dictionary.coordinates.latitude]);
    }
  }

  function clearDictionary() {
    selectedDictionaryId = null;
    // const map = getMap();
    // map.setZoom(defaultZoom);
  }

  let showAllMyDictionaries = false;
</script>

<!-- To Consider: for longer dictionaries on mobile, if we want to make the map still show when showing dictionary details, we need to add a media query (less than md) which sets this div's max-height: 75vh and adds overflow-y-auto -->
<div
  class="{!(searchString || searchFocused || currentDictionary)
    ? 'absolute sm:relative w-full sm:flex z-10 max-h-full'
    : 'h-full'}
  flex flex-col sm:h-full sm:border-r border-gray-200">
  {#if !currentDictionary}
    <div class="relative text-xl px-2 mt-2 sm:mb-2">
      <div
        class="absolute inset-y-0 left-0 pl-5 flex items-center
        pointer-events-none">
        <i class="far fa-search text-gray-500" />
      </div>
      <input
        type="text"
        bind:value={searchString}
        class="form-input w-full pl-10 pr-8 py-1 rounded-lg
        text-gray-900 placeholder-gray-500 shadow"
        placeholder={$_('home.find_dictionary', {
          default: 'Find a Dictionary',
        })}
        on:focus={() => (searchFocused = true)}
        on:blur={delayedSearchClose} />
      {#if searchString || searchFocused}
        <button
          on:click={() => (searchString = '')}
          class="absolute inset-y-0 right-0 px-4 flex items-center
          focus:outline-none">
          <i class="far fa-times text-gray-400" />
        </button>
      {/if}
    </div>

    <div
      class="{!(searchString || searchFocused || currentDictionary) && 'hidden sm:flex'}
      overflow-y-auto flex flex-col flex-1"
      in:fly={{ y: -15, duration: 150 }}
      on:click={keepSearchOpen}>
      {#if searchString}
        <div class="text-sm text-gray-500 px-3 my-1">
          <i> {filteredDictionaries.length}/{dictionaries.length} </i>
        </div>
      {/if}

      {#if !searchString && $myDictionaries && $myDictionaries.length}
        <div class="text-sm font-semibold px-3 my-1">
          {$_('home.my_dictionaries', { default: 'My Dictionaries' })}
        </div>
        {#each $myDictionaries as dictionary}
          <button
            type="button"
            class="text-left px-3 py-1 my-1 hover:bg-gray-200"
            on:click={() => setCurrentDictionary(dictionary)}>
            <div>{dictionary.name}</div>
            {#if dictionary.location}
              <small class="-mt-1 text-gray-600">{dictionary.location}</small>
            {/if}
          </button>
        {/each}
        <hr class="my-2" />
        <div class="text-sm font-semibold px-3 my-1">
          {$_('home.public_dictionaries', { default: 'Public Dictionaries' })}
          {#if $admin}
            (+ Private)
          {/if}
        </div>
      {/if}

      {#each filteredDictionaries as dictionary}
        <button
          type="button"
          class="text-left px-3 py-1 my-1 hover:bg-gray-200"
          on:click={() => setCurrentDictionary(dictionary)}>
          <div>{dictionary && dictionary.name}</div>
          {#if dictionary.location}
            <small class="-mt-1 text-gray-600">{dictionary.location}</small>
          {/if}
        </button>
      {/each}
      {#if !filteredDictionaries.length}
        <div class="p-3">
          <i> {$_('home.no_results', { default: 'No Results' })} </i>
        </div>
      {/if}
    </div>

    <div class="mt-auto hidden sm:block border-t" />
    <div
      class="flex flex-wrap sm:flex-col overflow-y-auto
      overflow-x-hidden px-2 pb-2">
      {#if !searchFocused && $myDictionaries}
        {#each $myDictionaries as dictionary, i}
          {#if showAllMyDictionaries || i < 3}
            <button
              type="button"
              class="sm:hidden rounded px-3 py-2 bg-white mt-2"
              on:click={() => setCurrentDictionary(dictionary)}>
              {dictionary && dictionary.name}
            </button>
            <div class="w-2 sm:hidden" />
          {/if}
        {/each}
        {#if $myDictionaries.length > 3 && !showAllMyDictionaries}
          <button
            type="button"
            class="sm:hidden rounded px-3 py-2 bg-white mt-2"
            on:click={() => (showAllMyDictionaries = true)}>
            {$_('home.show_all_my_dictionaries', {
              default: 'Show all my dictionaries',
            })}
          </button>
          <div class="w-2 sm:hidden" />
        {/if}
      {/if}
      {#if !(searchFocused && filteredDictionaries.length > 3)}
        <Button href="/create-dictionary" class="mt-2" color="black" form="primary">
          <i class="far fa-plus" />
          {$_('create.create_new_dictionary', {
            default: 'Create New Dictionary',
          })}
        </Button>
        <div class="w-2 sm:hidden" />

        <Button
          href="/dictionaries"
          color="black"
          form="simple"
          class="mt-2 opacity-75 focus:opacity-100
      sm:opacity-100 bg-white sm:bg-transparent">
          <i class="far fa-list" />
          {$_('home.list_of_dictionaries', { default: 'List of Dictionaries' })}
        </Button>
        <div class="w-2 sm:hidden" />

        <Button
          href="/about"
          color="black"
          form="simple"
          class="mt-2 opacity-75 focus:opacity-100
      sm:opacity-100 bg-white sm:bg-transparent sm:hidden">
          <i class="far fa-info-circle" />
          <span class="ml-1">{$_('header.about', { default: 'About' })}</span>
        </Button>
      {/if}
    </div>
  {:else}
    <div class="p-2 flex flex-col flex-1">
      <button
        type="button"
        class="flex flex-start items-center px-2 py-2 -mx-1 rounded hover:bg-gray-200"
        on:click={clearDictionary}>
        <i class="far fa-chevron-left rtl-x-flip" />
        <div class="w-1" />
        {$_('misc.back', { default: 'Back' })}
      </button>
      {#await import('./SelectedDict.svelte') then { default: SelectedDict }}
        <SelectedDict dictionary={currentDictionary} />
      {/await}
    </div>
  {/if}
</div>
