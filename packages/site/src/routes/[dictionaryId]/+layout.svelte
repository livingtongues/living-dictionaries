<script lang="ts">
  import { page } from '$app/stores';
  import SideMenu from './SideMenu.svelte';
  import { dictionary_deprecated as dictionaryStore, algoliaQueryParams } from '$lib/stores';
  import Header from '$lib/components/shell/Header.svelte';
  import { Button, ResponsiveSlideover } from 'svelte-pieces';
  import type { LayoutData } from './$types';
  import './custom-fonts.css';
  export let data: LayoutData;

  $: if (data.dictionary)
    dictionaryStore.set(data.dictionary);

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

    <button type="button" class="p-3 md:hidden print:p-0" on:click={() => (menuOpen = !menuOpen)}>
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
    side={$page.data.t('page.direction') === 'rtl' ? 'right' : 'left'}
    showWidth={'md'}
    bind:open={menuOpen}>
    <div
      class="h-full md:h-unset flex flex-col flex-shrink-0 md:top-12 md:sticky md:w-44 lg:w-48 print:hidden">
      <SideMenu bind:menuOpen />
      <hr class="md:hidden" />
      <Button form="menu" class="text-left !md:hidden" onclick={() => (menuOpen = false)}>
        <i class="far fa-times fa-lg fa-fw" />
        {$page.data.t('misc.close')}
      </Button>
    </div>
  </ResponsiveSlideover>
  <div class="hidden md:block w-3 flex-shrink-0 print:hidden" />
  <div class="flex-grow">
    <slot />
  </div>
</div>
