<script lang="ts">
  import { Button, ShowHide } from 'svelte-pieces'
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
  import Footer from '$lib/components/shell/Footer.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import { browser } from '$app/environment'

  export let data: PageData
  $: ({ admin, get_private_dictionaries, get_public_dictionaries, my_dictionaries, user_latitude, user_longitude } = data)

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

<div class="flex flex-col sm:flex-row">
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
  <div class="relative h-50vh sm:h-70vh sm:flex-grow sm:p-3">
    <Map bind:this={mapComponent} style="mapbox://styles/mapbox/light-v10?optimize=true" zoom={2.5} options={{ projection: 'globe' }} lat={+user_latitude} lng={+user_longitude}>
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
</div>

<div class="border-t border-gray-200"></div>

<div class="py-5 px-3 sm:px-8 text-3xl font-semibold text-center max-w-6xl mx-auto">
  Serving 210 language communities around the globe with over 1/4 million published entries, as well as hundreds more dictionaries in progress.
</div>

<div class="text-center">
  <Button
    href="/dictionaries"
    color="black"
    size="lg"
    class="mb-7">
    <span class="i-fa-solid-list -mt-1" />
    {$page.data.t('home.list_of_dictionaries')}
  </Button>
</div>

<div class="border-t border-gray-200"></div>

<div class="text-center px-3 py-8">
  <Button href="/create-dictionary" size="lg" color="black" form="filled">
    <span class="i-fa-solid-plus -mt-1.25" />
    {$page.data.t('create.create_new_dictionary')}
  </Button>
</div>

<Footer />

<SeoMetaTags
  title={$page.data.t('misc.LD')}
  description="Living Dictionaries are language documentation tools that support endangered and under-represented languages. This online platform was created by Living Tongues Institute for Endangered Languages as a free multimedia resource for community activists and linguists who want to build digital dictionaries and phrasebooks."
  keywords="Minority Languages, Indigenous Languages, Language Documentation, Dictionary, Minority Community, Language Analysis, Language Education, Endangered Languages, Language Revitalization, Linguistics, Word Lists, Linguistic Analysis, Dictionaries, Living Dictionaries, Living Tongues, Under-represented Languages, Tech Resources, Language Sustainability, Language Resources, Diaspora Languages, Elicitation, Language Archives, Ancient Languages, World Languages, Obscure Languages, Little Known languages, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Dictionary with audio, dictionary with pronunciations, dictionary with speakers, dictionaries that you can edit" />
