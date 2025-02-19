<script lang="ts">
  import { ShowHide } from 'svelte-pieces'
  import type { DictionaryView } from '@living-dictionaries/types'
  import { onMount } from 'svelte'
  import type { PageData } from './$types'
  import { page } from '$app/stores'
  import Map from '$lib/components/maps/mapbox/map/Map.svelte'
  import ToggleStyle from '$lib/components/maps/mapbox/controls/ToggleStyle.svelte'
  import NavigationControl from '$lib/components/maps/mapbox/controls/NavigationControl.svelte'
  import CustomControl from '$lib/components/maps/mapbox/controls/CustomControl.svelte'
  import DictionaryPoints from '$lib/components/home/DictionaryPoints.svelte'
  import Search from '$lib/components/home/Search.svelte'
  import Header from '$lib/components/shell/Header.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import { browser } from '$app/environment'

  export let data: PageData
  $: ({ admin, get_private_dictionaries, get_public_dictionaries, my_dictionaries } = data)

  let public_dictionaries: DictionaryView[] = []
  let private_dictionaries: DictionaryView[] = []

  onMount(() => {
    get_public_dictionaries().then(_dictionaries => public_dictionaries = _dictionaries)
  })

  let selectedDictionaryId: string
  let selectedDictionary: DictionaryView
  $: dictionaries = [...public_dictionaries, ...private_dictionaries, ...$my_dictionaries]
  $: if (selectedDictionaryId)
    selectedDictionary = dictionaries.find(d => d.id === selectedDictionaryId)
  else
    selectedDictionary = null

  $: if (browser && $admin) {
    get_private_dictionaries().then(_dictionaries => private_dictionaries = _dictionaries)
  } else {
    private_dictionaries = []
  }

  let mapComponent: Map
</script>

<Header />

<main
  class="top-12 fixed bottom-0 right-0 left-0 flex flex-col sm:flex-row border-t border-gray-200">
  <div class="sm:w-72 max-h-full">
    <Search
      {dictionaries}
      my_dictionaries={$my_dictionaries}
      bind:selectedDictionaryId
      on_selected_dictionary_point={(point) => {
        if (point) {
          mapComponent.setZoom(7)
          mapComponent.setCenter([point.coordinates.longitude, point.coordinates.latitude])
        }
      }} />
  </div>
  <div class="relative flex-1">
    <Map bind:this={mapComponent} style="mapbox://styles/mapbox/light-v10?optimize=true" zoom={2}>
      {#if selectedDictionary?.coordinates}
        {#if selectedDictionary.coordinates.points}
          {#await import('$lib/components/maps/mapbox/map/Marker.svelte') then { default: Marker }}
            {#each selectedDictionary.coordinates.points as point, index (point)}
              <Marker lat={point.coordinates.latitude} lng={point.coordinates.longitude} color={index === 0 ? 'blue' : 'black'} />
            {/each}
          {/await}
        {/if}
        {#if selectedDictionary.coordinates.regions}
          {#await import('$lib/components/maps/mapbox/map/Region.svelte') then { default: Region }}
            {#each selectedDictionary.coordinates.regions as region (region)}
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

          {#if !hide && private_dictionaries.length}
            <DictionaryPoints
              dictionaries={private_dictionaries}
              type="private"
              bind:selectedDictionaryId />
          {/if}
        </ShowHide>
      {/if}
      <DictionaryPoints dictionaries={public_dictionaries} bind:selectedDictionaryId />
      {#if $my_dictionaries.length}
        <DictionaryPoints
          dictionaries={$my_dictionaries}
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
