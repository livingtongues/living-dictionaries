<script lang="ts">
  import { Button, ShowHide } from '$lib/svelte-pieces'
  import type { DictionaryView } from '@living-dictionaries/types'
  import { onMount } from 'svelte'
  import type { PageData } from './$types'
  import { page } from '$app/stores'
  import Map from '$lib/components/maps/mapbox/map/Map.svelte'
  import ToggleStyle from '$lib/components/maps/mapbox/controls/ToggleStyle.svelte'
  import NavigationControl from '$lib/components/maps/mapbox/controls/NavigationControl.svelte'
  import CustomControl from '$lib/components/maps/mapbox/controls/CustomControl.svelte'
  import DictionaryPoints from '$lib/components/home/DictionaryPoints.svelte'
  import Header from '$lib/components/shell/Header.svelte'
  import Footer from '$lib/components/shell/Footer.svelte'
  import SeoMetaTags from '$lib/components/SeoMetaTags.svelte'
  import { browser } from '$app/environment'
  import MyDictionaries from '$lib/components/home/MyDictionaries.svelte'
  import SearchDictionaries from '$lib/components/home/SearchDictionaries.svelte'

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();
  let { admin, get_private_dictionaries, get_public_dictionaries, my_dictionaries, user_latitude, user_longitude } = $derived(data)

  let public_dictionaries: DictionaryView[] = $state([])
  let private_dictionaries: DictionaryView[] = $state([])

  onMount(() => {
    get_public_dictionaries().then(_dictionaries => public_dictionaries = _dictionaries)
  })

  let selectedDictionaryId: string = $state()
  let selectedDictionary: DictionaryView = $state()
  let dictionaries = $derived([...public_dictionaries, ...private_dictionaries, ...$my_dictionaries])
  $effect(() => {
    if (selectedDictionaryId)
      selectedDictionary = dictionaries.find(d => d.id === selectedDictionaryId)
    else
      selectedDictionary = null
  });

  const featured_dict_names = ['Achi', 'GtaɁ', 'Gutob', 'Kihunde', 'Sora']
  let featured_dictionaries = $derived(public_dictionaries.filter(d => featured_dict_names.includes(d.name)))

  $effect(() => {
    if (browser && $admin) {
      get_private_dictionaries().then(_dictionaries => private_dictionaries = _dictionaries)
    } else {
      private_dictionaries = []
    }
  });

  let mapComponent: Map = $state()

  function setCurrentDictionary(dictionary: DictionaryView) {
    selectedDictionaryId = dictionary.id
    if (dictionary.coordinates?.points?.[0]) {
      const [point] = dictionary.coordinates.points
      mapComponent.setZoom(7)
      mapComponent.setCenter([point.coordinates.longitude, point.coordinates.latitude])
    }
  }
</script>

<Header />

<div class="flex flex-col md:flex-row">
  <div class="md:w-72 px-2 flex flex-col">
    {#if !selectedDictionary}
      <SearchDictionaries
        {dictionaries}
        {setCurrentDictionary} />
      {#if $my_dictionaries?.length}
        <MyDictionaries
          my_dictionaries={$my_dictionaries}
          {setCurrentDictionary} />
      {:else}
        <div class="lt-md:hidden flex flex-col">
          {#each featured_dictionaries as dictionary}
            <Button
              class="mb-1"
              color="black"
              onclick={() => setCurrentDictionary(dictionary)}>
              {dictionary.name}
            </Button>
          {/each}
        </div>
      {/if}
    {:else}
      <button
        type="button"
        class="flex flex-start items-center px-2 py-2 -mx-1 rounded hover:bg-gray-200"
        onclick={() => (selectedDictionaryId = null)}>
        <span class="i-fa6-solid-chevron-left rtl-x-flip"></span>
        <div class="w-1"></div>
        {$page.data.t('misc.back')}
      </button>
      {#await import('$lib/components/home/SelectedDict.svelte') then { default: SelectedDict }}
        <SelectedDict dictionary={selectedDictionary} />
      {/await}
    {/if}
  </div>
  <div class="relative h-50vh md:h-70vh md:flex-grow">
    <Map bind:this={mapComponent} style="mapbox://styles/mapbox/light-v10?optimize=true" zoom={2} options={{ projection: 'globe' }} lat={+user_latitude} lng={+user_longitude}>
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
        <ShowHide  >
          {#snippet children({ show, toggle })}
                    <CustomControl position="bottom-right">
              <button type="button" class="whitespace-nowrap w-90px! px-2" onclick={toggle}>Toggle Private</button>
            </CustomControl>

            {#if show && private_dictionaries.length}
              <DictionaryPoints
                dictionaries={private_dictionaries}
                type="private"
                bind:selectedDictionaryId />
            {/if}
                            {/snippet}
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

<!-- <div class="border-t border-gray-200"></div> -->
<div class="w-full bg-gray-200 text-center">

  <div class="m-auto py-6 px-6 sm:px-8 text-2xl font-semibold text-center max-w-6xl">
    {$page.data.t('home.main_banner')}
  </div>

  <div class="text-center">
    <Button
      href="/dictionaries"
      color="black"
      size="lg"
      class="mb-7">
      <span class="i-fa-solid-list -mt-1"></span>
      {$page.data.t('home.list_of_dictionaries')}
    </Button>
  </div>
</div>

<div class="border-t border-gray-200"></div>

<div class="text-center px-3 py-8">
  <Button href="/create-dictionary" size="lg" color="black" form="filled">
    <span class="i-fa-solid-plus -mt-1.25"></span>
    {$page.data.t('create.create_new_dictionary')}
  </Button>
</div>

<Footer />

<SeoMetaTags
  title={$page.data.t('misc.LD')}
  description="Living Dictionaries are language documentation tools that support endangered and under-represented languages. This online platform was created by Living Tongues Institute for Endangered Languages as a free multimedia resource for community activists and linguists who want to build digital dictionaries and phrasebooks."
  keywords="Minority Languages, Indigenous Languages, Language Documentation, Dictionary, Minority Community, Language Analysis, Language Education, Endangered Languages, Language Revitalization, Linguistics, Word Lists, Linguistic Analysis, Dictionaries, Living Dictionaries, Living Tongues, Under-represented Languages, Tech Resources, Language Sustainability, Language Resources, Diaspora Languages, Elicitation, Language Archives, Ancient Languages, World Languages, Obscure Languages, Little Known languages, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Dictionary with audio, dictionary with pronunciations, dictionary with speakers, dictionaries that you can edit" />
