<script lang="ts">
  import { getCollection } from 'sveltefirets';
  import { where } from 'firebase/firestore';

  import { _ } from 'svelte-i18n';
  import type { IDictionary } from '@living-dictionaries/types';
  import { admin, myDictionaries } from '$lib/stores';

  import ShowHide from 'svelte-pieces/functions/ShowHide.svelte';
  import Map from '@living-dictionaries/parts/src/lib/maps/mapbox/map/Map.svelte';
  import ToggleStyle from '@living-dictionaries/parts/src/lib/maps/mapbox/controls/ToggleStyle.svelte';
  import NavigationControl from '@living-dictionaries/parts/src/lib/maps/mapbox/controls/NavigationControl.svelte';
  import CustomControl from '@living-dictionaries/parts/src/lib/maps/mapbox/controls/CustomControl.svelte';

  import DictionaryPoints from '$lib/components/home/DictionaryPoints.svelte';
  import Search from '$lib/components/home/Search.svelte';
  import Header from '$lib/components/shell/Header.svelte';

  import type { PageData } from './$types';
  export let data: PageData;
  $: publicDictionaries = data.publicDictionaries || [];
  let privateDictionaries: IDictionary[] = [];
  let selectedDictionaryId: string;
  let selectedDictionary: IDictionary;
  $: dictionaries = [...publicDictionaries, ...privateDictionaries, ...$myDictionaries];
  $: if (selectedDictionaryId) {
    selectedDictionary = dictionaries.find((d) => d.id === selectedDictionaryId);
  } else {
    selectedDictionary = null;
  }

  import { browser } from '$app/environment';
  $: {
    if (browser && $admin) {
      getCollection<IDictionary>('dictionaries', [where('public', '!=', true)]).then(
        (docs) => (privateDictionaries = docs)
      );
    } else {
      privateDictionaries = [];
    }
  }

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
      {dictionaries}
      bind:selectedDictionaryId
      on:selectedDictionary={({ detail }) => {
        const { coordinates } = detail;
        if (coordinates) {
          mapComponent.setZoom(7);
          mapComponent.setCenter([coordinates.longitude, coordinates.latitude]);
        }
      }} />
  </div>
  <div class="relative flex-1">
    <Map bind:this={mapComponent} style="mapbox://styles/mapbox/light-v10?optimize=true">
      {#if selectedDictionary?.coordinates?.latitude}
        {#await import('@living-dictionaries/parts/src/lib/maps/mapbox/map/Marker.svelte') then { default: Marker }}
          <Marker
            lat={selectedDictionary.coordinates.latitude}
            lng={selectedDictionary.coordinates.longitude}
            color="blue" />
          {#if selectedDictionary.points}
            {#each selectedDictionary.points as point (point)}
              <Marker lat={point.coordinates.latitude} lng={point.coordinates.longitude} />
            {/each}
          {/if}
        {/await}
        {#if selectedDictionary.regions}
          {#await import('@living-dictionaries/parts/src/lib/maps/mapbox/map/Region.svelte') then { default: Region }}
            {#each selectedDictionary.regions as region (region)}
              <Region {region} />
            {/each}
          {/await}
        {/if}
      {/if}
      {#if $admin}
        <ShowHide let:show={hide} let:toggle>
          <CustomControl position="bottom-right">
            <button class="whitespace-nowrap w-full px-2" on:click={toggle}>Toggle Private</button>
          </CustomControl>

          {#if !hide && privateDictionaries.length}
            <DictionaryPoints
              dictionaries={privateDictionaries}
              type="private"
              bind:selectedDictionaryId />
          {/if}
        </ShowHide>
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
