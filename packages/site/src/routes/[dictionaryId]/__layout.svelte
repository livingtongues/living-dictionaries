<script context="module" lang="ts">
  import type { IDictionary } from '@living-dictionaries/types';
  import { getDocument } from '$sveltefirets';

  import type { Load } from '@sveltejs/kit';
  export const load: Load = async ({ params }) => {
    try {
      const dictionary = await getDocument<IDictionary>(`dictionaries/${params.dictionaryId}`);
      if (dictionary) {
        return { props: { dictionary } };
      } else {
        return { status: 301, redirect: '/' };
      }
    } catch (error) {
      return { status: 500, error };
    }
  };
</script>

<script lang="ts">
  import { _ } from 'svelte-i18n';

  import SideMenu from './_SideMenu.svelte';

  export let dictionary: IDictionary;
  import { dictionary as dictionaryStore, algoliaQueryParams } from '$lib/stores';
  import Header from '$lib/components/shell/Header.svelte';

  if (dictionary) {
    dictionaryStore.set(dictionary);
  }

  let menuOpen = false;
</script>

<svelte:head>
  <title>
    {$dictionaryStore.name}
    {$_('misc.LD_singular', { default: 'Living Dictionary' })}
  </title>
</svelte:head>

<Header>
  <div
    slot="left"
    class="font-semibold sm:text-xl overflow-x-auto md:overflow-hidden md:overflow-ellipsis">
    <a
      class="p-3 hover:text-black hidden md:inline"
      href="/"
      on:click={() => ($algoliaQueryParams = '')}>
      <i class="fas fa-home" />
    </a>
    <div class="w-2 hidden md:inline" />

    <button class="p-3 md:hidden" on:click={() => (menuOpen = !menuOpen)}>
      <i class="far fa-bars" />&nbsp;
      {$dictionaryStore.name}
    </button>
    <a class="hover:text-black hidden md:inline" href="/{dictionary.id}">
      {$dictionaryStore.name}
    </a>
  </div>
</Header>

<div class="flex px-3">
  <div
    class:!translate-x-0={menuOpen}
    class="menu ltr:!-translate-x-full rtl:!translate-x-full ltr:left-0 rtl:right-0 md:!transform-none">
    <SideMenu bind:menuOpen />
    <button class="close-menu" on:click={() => (menuOpen = false)}>
      <i class="far fa-times fa-lg fa-fw" />
      {$_('misc.close', { default: 'Close' })}
    </button>
  </div>
  <div class="hidden md:block w-3 flex-shrink-0" />
  <div class:hide-backdrop={!menuOpen} on:click={() => (menuOpen = false)} class="backdrop" />
  <div class="flex-grow">
    <slot />
  </div>
</div>

<style>
  .menu {
    @apply overflow-y-auto h-full 
    flex flex-col flex-shrink-0 
    z-50 md:z-0 md:top-12
    fixed md:sticky 
    inset-y-0
    w-56 md:w-44 lg:w-48 
    bg-white 
    shadow-lg md:shadow-none 
    border-r border-l md:border-none 
    transform transition duration-300 ease-in-out;
  }

  .backdrop {
    @apply fixed inset-0 bg-gray-900 bg-opacity-25 z-40 transition-opacity duration-300;
  }
  .hide-backdrop {
    @apply opacity-0 pointer-events-none;
  }
  .close-menu {
    @apply p-3 md:hidden text-sm font-medium text-gray-700 border-t flex justify-start items-center;
  }

  @font-face {
    font-family: 'sompeng';
    src: url('/fonts/Sompeng-Code200365k.ttf') format('truetype');
  }

  :global(.sompeng) {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue',
      Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol',
      'Noto Color Emoji', 'sompeng';
    font-weight: normal;
    font-style: normal;
  }
</style>
