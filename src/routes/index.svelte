<script context="module" lang="ts">
  import { fetchDictionaries } from '$lib/helpers/fetchDictionaries';
  import { browser } from '$app/env';

  import type { Load } from '@sveltejs/kit';
  export const load: Load = async () => {
    try {
      const publicDictionaries = browser
        ? await getCollection<IDictionary>('dictionaries', [
            orderBy('name'),
            where('public', '==', true),
          ])
        : await fetchDictionaries();
      return { props: { publicDictionaries } };
    } catch (error) {
      return {
        error, // status: res.status,
      };
    }
  };
</script>

<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { IDictionary } from '$lib/interfaces';
  import { admin, myDictionaries } from '$lib/stores';

  import Mapbox from '$lib/components/home/Mapbox.svelte';
  import Search from '$lib/components/home/Search.svelte';
  import Header from '$lib/components/shell/Header.svelte';
  import { getCollection } from '$sveltefire/firestore';
  import { orderBy, where } from 'firebase/firestore';

  export let publicDictionaries: IDictionary[] = [];
  let privateDictionaries: IDictionary[] = [];
  let selectedDictionaryId: string;

  import { onMount } from 'svelte';
  onMount(async () => {
    if ($admin) {
      privateDictionaries = await getCollection<IDictionary>('dictionaries', [
        where('public', '!=', true),
      ]);
    }
  });
</script>

<svelte:head>
  <title>{$_('misc.LD', { default: 'Living Dictionaries' })}</title>
</svelte:head>

<Header />

<main>
  <Mapbox>
    <div class="sm:w-72 max-h-full" slot="sidebar">
      <Search
        dictionaries={[...publicDictionaries, ...privateDictionaries, ...$myDictionaries]}
        bind:selectedDictionaryId
      />
    </div>
    {#await import('$lib/components/home/Dictionaries.svelte') then { default: Dictionaries }}
      {#if privateDictionaries.length}
        <Dictionaries
          dictionaries={privateDictionaries}
          source="private"
          bind:selectedDictionaryId
        />
      {/if}
      <Dictionaries dictionaries={publicDictionaries} bind:selectedDictionaryId />
      {#if $myDictionaries.length}
        <Dictionaries dictionaries={$myDictionaries} source="personal" bind:selectedDictionaryId />
      {/if}
    {/await}
  </Mapbox>
</main>

<style>
  main {
    @apply top-12 fixed bottom-0 right-0 left-0 flex flex-col sm:flex-row border-t border-gray-200;
  }
</style>
