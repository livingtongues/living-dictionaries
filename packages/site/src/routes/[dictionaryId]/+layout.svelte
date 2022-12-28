<script lang="ts">
  import { _ } from 'svelte-i18n';
  import SideMenu from './SideMenu.svelte';
  import { dictionary as dictionaryStore, algoliaQueryParams } from '$lib/stores';
  import Header from '$lib/components/shell/Header.svelte';
  import ResponsiveSlideover from 'svelte-pieces/ui/ResponsiveSlideover.svelte';
  import Button from 'svelte-pieces/ui/Button.svelte';

  import type { LayoutData } from './$types';
  export let data: LayoutData;

  if (data.dictionary) {
    dictionaryStore.set(data.dictionary);
  }

  let menuOpen = false;
</script>

<Header>
  <div
    slot="left"
    class="font-semibold sm:text-xl overflow-x-auto md:overflow-hidden md:overflow-ellipsis">
    <a
      class="p-3 hover:text-black hidden md:inline print:hidden"
      href="/"
      on:click={() => ($algoliaQueryParams = '')}>
      <i class="fas fa-home" />
    </a>
    <div class="w-2 hidden md:inline" />

    <button class="p-3 md:hidden print:p-0" on:click={() => (menuOpen = !menuOpen)}>
      <i class="far fa-bars print:hidden" />
      {$dictionaryStore.name}
    </button>
    <a class="hover:text-black hidden md:inline" href="/{$dictionaryStore.id}">
      {$dictionaryStore.name}
    </a>
  </div>
</Header>

<div class="flex px-3 print:px-0">
  <ResponsiveSlideover
    side={$_('direction') === 'rtl' ? 'right' : 'left'}
    showWidth={'md'}
    bind:open={menuOpen}>
    <div
      class="h-full md:h-unset flex flex-col flex-shrink-0 md:top-12 md:sticky md:w-44 lg:w-48 print:hidden">
      <SideMenu bind:menuOpen />
      <hr class="md:hidden" />
      <Button form="menu" class="text-left !md:hidden" on:click={() => (menuOpen = false)}>
        <i class="far fa-times fa-lg fa-fw" />
        {$_('misc.close', { default: 'Close' })}
      </Button>
    </div>
  </ResponsiveSlideover>
  <div class="hidden md:block w-3 flex-shrink-0 print:hidden" />
  <div class="flex-grow">
    <slot />
  </div>
</div>

<style>
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
