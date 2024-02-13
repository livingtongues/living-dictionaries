<script lang="ts">
  import { page } from '$app/stores';
  import { getCollection } from 'sveltefirets';
  import { where } from 'firebase/firestore';
  import type { IDictionary } from '@living-dictionaries/types';
  import { admin, myDictionaries } from '$lib/stores';
  import { ShowHide } from 'svelte-pieces';
  import Map from '$lib/components/maps/mapbox/map/Map.svelte';
  import ToggleStyle from '$lib/components/maps/mapbox/controls/ToggleStyle.svelte';
  import NavigationControl from '$lib/components/maps/mapbox/controls/NavigationControl.svelte';
  import CustomControl from '$lib/components/maps/mapbox/controls/CustomControl.svelte';
  import DictionaryPoints from '$lib/components/home/DictionaryPoints.svelte';
  import Search from '$lib/components/home/Search.svelte';
  import Header from '$lib/components/shell/Header.svelte';
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte';
  import { browser } from '$app/environment';
  import type { PageData } from './$types';
  export let data: PageData;

  $: publicDictionaries = data.publicDictionaries || [];
  let privateDictionaries: IDictionary[] = [];
  let selectedDictionaryId: string;
  let selectedDictionary: IDictionary;
  $: dictionaries = [...publicDictionaries, ...privateDictionaries, ...$myDictionaries];
  $: if (selectedDictionaryId)
    selectedDictionary = dictionaries.find((d) => d.id === selectedDictionaryId);
  else
    selectedDictionary = null;


  $: if (browser && $admin) {
    getCollection<IDictionary>('dictionaries', [where('public', '!=', true)]).then(
      (docs) => (privateDictionaries = docs)
    );
  } else {
    privateDictionaries = [];
  }

  let mapComponent: Map;
</script>

<Header />

<main
  class="top-18 fixed bottom-0 right-0 left-0 flex flex-col sm:flex-row border-t border-gray-200">
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
    <Map bind:this={mapComponent} style="mapbox://styles/mapbox/light-v10?optimize=true" zoom={2}>
      {#if selectedDictionary?.coordinates?.latitude}
        {#await import('$lib/components/maps/mapbox/map/Marker.svelte') then { default: Marker }}
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
          {#await import('$lib/components/maps/mapbox/map/Region.svelte') then { default: Region }}
            {#each selectedDictionary.regions as region (region)}
              <Region {region} />
            {/each}
          {/await}
        {/if}
      {/if}
      {#if $admin}
        <ShowHide let:show={hide} let:toggle>
          <CustomControl position="bottom-right">
            <button type="button" class="whitespace-nowrap w-90px! px-2" on:click={toggle}>Toggle Private</button>
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

<SeoMetaTags
  title={$page.data.t('misc.LD')}
  description="Living Dictionaries are language documentation tools that support endangered and under-represented languages. This online platform was created by Living Tongues Institute for Endangered Languages as a free multimedia resource for community activists and linguists who want to build digital dictionaries and phrasebooks."
  keywords="Minority Languages, Indigenous Languages, Language Documentation, Dictionary, Minority Community, Language Analysis, Language Education, Endangered Languages, Language Revitalization, Linguistics, Word Lists, Linguistic Analysis, Dictionaries, Living Dictionaries, Living Tongues, Under-represented Languages, Tech Resources, Language Sustainability, Language Resources, Diaspora Languages, Elicitation, Language Archives, Ancient Languages, World Languages, Obscure Languages, Little Known languages, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Dictionary with audio, dictionary with pronunciations, dictionary with speakers, dictionaries that you can edit" />
