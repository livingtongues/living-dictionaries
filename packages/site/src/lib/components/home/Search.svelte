<script lang="ts">
  import { page } from '$app/stores';
  import type { IDictionary } from '@living-dictionaries/types';
  import { fly } from 'svelte/transition';
  import { Button, ShowHide } from 'svelte-pieces';
  import { createEventDispatcher } from 'svelte';

  export let dictionaries: IDictionary[] = [];
  export let my_dictionaries: IDictionary[] = [];
  export let selectedDictionaryId: string;
  let currentDictionary: IDictionary;
  $: ({admin} = $page.data)

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
  $: filteredDictionaries = dictionaries
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

  let searchBlurTimeout;
  function delayedSearchClose() {
    searchBlurTimeout = setTimeout(() => {
      searchFocused = false;
    }, 200);
  }

  function keepSearchOpen() {
    clearTimeout(searchBlurTimeout);
  }

  const dispatch = createEventDispatcher<{ selectedDictionary: IDictionary }>();
  function setCurrentDictionary(dictionary: IDictionary) {
    selectedDictionaryId = dictionary.id;
    dispatch('selectedDictionary', dictionary);
    searchString = '';
  }

  function clearDictionary() {
    selectedDictionaryId = null;
  }

  $: active = searchString || searchFocused || currentDictionary;
</script>

<!-- To Consider: for longer dictionaries on mobile, if we want to make the map still show when showing dictionary details, we need to add a media query (less than md) which sets this div's max-height: 75vh and adds overflow-y-auto -->

<div
  class:h-full={active}
  class:absolute={!active}
  class:sm:relative={!active}
  class:w-full={!active}
  class:sm:flex={!active}
  class:z-10={!active}
  class:max-h-full={!active}
  class="flex flex-col sm:h-full sm:border-r border-gray-200">
  {#if !currentDictionary}
    <div class="relative text-xl px-2 mt-2 sm:mb-2">
      <div
        class="absolute inset-y-0 left-0 pl-5 flex items-center
          pointer-events-none text-gray-500">
        <span class="i-carbon-search" />
      </div>
      <input
        type="text"
        bind:value={searchString}
        class="form-input w-full pl-10 pr-8 py-1 rounded-lg
          text-gray-900 placeholder-gray-500 shadow"
        placeholder={$page.data.t('home.find_dictionary')}
        on:focus={() => (searchFocused = true)}
        on:blur={delayedSearchClose} />
      {#if searchString || searchFocused}
        <button type="button" on:click={() => (searchString = '')} class="absolute inset-y-0 right-0 px-4 flex items-center focus:outline-none">
          <span class="i-la-times text-gray-400" />
        </button>
      {/if}
    </div>

    <div
      class:flex={active}
      class:hidden={!active}
      class:sm:flex={!active}
      class="overflow-y-auto flex-col flex-1"
      in:fly={{ y: -15, duration: 150 }}
      on:click={keepSearchOpen}>
      {#if searchString}
        <div class="text-sm text-gray-500 px-3 my-1">
          <i> {filteredDictionaries.length}/{dictionaries.length} </i>
        </div>
      {/if}

      {#if !searchString && my_dictionaries?.length}
        <div class="text-sm font-semibold px-3 my-1">
          {$page.data.t('home.my_dictionaries')}
        </div>
        {#each my_dictionaries as dictionary}
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
          {$page.data.t('home.public_dictionaries')}
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
          <div>{dictionary?.name}</div>
          {#if dictionary.location}
            <small class="-mt-1 text-gray-600">{dictionary.location}</small>
          {/if}
        </button>
      {/each}
      {#if !filteredDictionaries.length}
        <div class="p-3">
          <i> {$page.data.t('home.no_results')} </i>
        </div>
      {/if}
    </div>

    <div class="mt-auto hidden sm:block border-t" />
    <div
      class="flex flex-wrap sm:flex-col overflow-y-auto
        overflow-x-hidden px-2 pb-2">
      <ShowHide let:show let:toggle>
        {#if !searchFocused && my_dictionaries}
          {#each my_dictionaries as dictionary, i}
            {#if show || i < 3}
              <button
                type="button"
                class="sm:hidden rounded px-3 py-2 bg-white mt-2"
                on:click={() => setCurrentDictionary(dictionary)}>
                {dictionary?.name}
              </button>
              <div class="w-2 sm:hidden" />
            {/if}
          {/each}
          {#if my_dictionaries.length > 3 && !show}
            <button
              type="button"
              class="sm:hidden rounded px-3 py-2 bg-white mt-2"
              on:click={toggle}>
              {$page.data.t('home.show_all_my_dictionaries')}
            </button>
            <div class="w-2 sm:hidden" />
          {/if}
        {/if}
      </ShowHide>
      {#if !(searchFocused && filteredDictionaries.length > 3)}
        <Button href="/create-dictionary" class="mt-2" color="black" form="filled">
          <span class="i-fa-solid-plus -mt-1.25" />
          {$page.data.t('create.create_new_dictionary')}
        </Button>
        <div class="w-2 sm:hidden" />

        <Button
          href="/dictionaries"
          color="black"
          form="simple"
          class="mt-2 opacity-75 focus:opacity-100
            sm:opacity-100 bg-white sm:bg-transparent">
          <span class="i-fa-solid-list -mt-1" />
          {$page.data.t('home.list_of_dictionaries')}
        </Button>
        <div class="w-2 sm:hidden" />

        <Button
          href="/about"
          color="black"
          form="simple"
          class="mt-2 opacity-75 focus:opacity-100
            sm:opacity-100 bg-white sm:bg-transparent !sm:hidden">
          <i class="far fa-info-circle" />
          <span class="ml-1">{$page.data.t('header.about')}</span>
        </Button>
      {/if}
    </div>
  {:else}
    <div class="p-2 flex flex-col flex-1">
      <button
        type="button"
        class="flex flex-start items-center px-2 py-2 -mx-1 rounded hover:bg-gray-200"
        on:click={clearDictionary}>
        <span class="i-fa6-solid-chevron-left rtl-x-flip" />
        <div class="w-1" />
        {$page.data.t('misc.back')}
      </button>
      {#await import('./SelectedDict.svelte') then { default: SelectedDict }}
        <SelectedDict dictionary={currentDictionary} />
      {/await}
    </div>
  {/if}
</div>
