<script context="module" lang="ts">
  import { getCollection } from 'sveltefirets';
  import { orderBy, where } from 'firebase/firestore';

  import type { Load } from '@sveltejs/kit';
  export const load: Load = async () => {
    try {
      const publicDictionaries = await getCollection<IDictionary>('dictionaries', [
        orderBy('name'),
        where('public', '==', true),
      ]);
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
  import type { IDictionary } from '@living-dictionaries/types';
  import { admin, myDictionaries } from '$lib/stores';

  import Map from '@living-dictionaries/parts/src/lib/maps/mapbox/map/Map.svelte';
  import ToggleStyle from '@living-dictionaries/parts/src/lib/maps/mapbox/controls/ToggleStyle.svelte';
  import NavigationControl from '@living-dictionaries/parts/src/lib/maps/mapbox/controls/NavigationControl.svelte';
  import { getTimeZoneLongitude } from '@living-dictionaries/parts/src/lib/maps/getTimeZoneLongitude';
  import DictionaryPoints from '$lib/components/home/DictionaryPoints.svelte';
  import Search from '$lib/components/home/Search.svelte';
  import Header from '$lib/components/shell/Header.svelte';

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

  let mapComponent: Map;
</script>

<svelte:head>
  <title>{$_('misc.LD', { default: 'Living Dictionaries' })}</title>
</svelte:head>

<Header />

<main
  class="top-12 fixed bottom-0 right-0 left-0 flex flex-col sm:flex-row border-t border-gray-200">
  <div class="sm:w-72 max-h-full">
    <Search
      dictionaries={[...publicDictionaries, ...privateDictionaries, ...$myDictionaries]}
      bind:selectedDictionaryId
      on:selectedDictionary={({ detail: { coordinates } }) => {
        if (coordinates) {
          mapComponent.setZoom(7);
          mapComponent.setCenter([coordinates.longitude, coordinates.latitude]);
        }
      }} />
  </div>
  <div class="relative flex-1">
    <Map
      bind:this={mapComponent}
      center={[getTimeZoneLongitude() || -80, 10]}
      style="mapbox://styles/mapbox/light-v10?optimize=true">
      {#if privateDictionaries.length}
        <DictionaryPoints
          dictionaries={privateDictionaries}
          type="private"
          bind:selectedDictionaryId />
      {/if}
      <DictionaryPoints dictionaries={publicDictionaries} bind:selectedDictionaryId />
      {#if $myDictionaries.length}
        <DictionaryPoints
          dictionaries={$myDictionaries}
          type="personal"
          bind:selectedDictionaryId />
      {/if}
      <NavigationControl position="bottom-right" showCompass={false} />
      <ToggleStyle />
    </Map>
  </div>
</main>
