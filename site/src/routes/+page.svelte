<script lang="ts">
  import { run } from 'svelte/legacy'

  import type { DictionaryView } from '$lib/types'
  import { onMount } from 'svelte'
  import type { PageData } from './$types'
  import { Button, ShowHide } from '$lib/svelte-pieces'
  import { page } from '$app/state'
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
  import IconFa6SolidChevronLeft from '~icons/fa6-solid/chevron-left'
  import IconFaSolidList from '~icons/fa-solid/list'
  import IconFaSolidPlus from '~icons/fa-solid/plus'

  interface Props {
    data: PageData
  }

  const { data }: Props = $props()
  const { auth_user, get_private_dictionaries, get_public_dictionaries, my_dictionaries, user_latitude, user_longitude } = $derived(data)

  let public_dictionaries: DictionaryView[] = $state([])
  let private_dictionaries: DictionaryView[] = $state([])

  onMount(() => {
    get_public_dictionaries().then(_dictionaries => public_dictionaries = _dictionaries)
  })

  let selectedDictionaryId: string = $state()
  let selectedDictionary: DictionaryView = $state()
  const dictionaries = $derived([...public_dictionaries, ...private_dictionaries, ...$my_dictionaries])
  run(() => {
    if (selectedDictionaryId)
      selectedDictionary = dictionaries.find(d => d.id === selectedDictionaryId)
    else
      selectedDictionary = null
  })

  const featured_dict_names = ['Achi', 'GtaɁ', 'Gutob', 'Kihunde', 'Sora']
  const featured_dictionaries = $derived(public_dictionaries.filter(d => featured_dict_names.includes(d.name)))

  run(() => {
    if (browser && auth_user.admin_level >= 1) {
      get_private_dictionaries().then(_dictionaries => private_dictionaries = _dictionaries)
    } else {
      private_dictionaries = []
    }
  })

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

<div class="home-layout">
  <div class="sidebar">
    {#if !selectedDictionary}
      <SearchDictionaries
        {dictionaries}
        {setCurrentDictionary} />
      {#if $my_dictionaries?.length}
        <MyDictionaries
          my_dictionaries={$my_dictionaries}
          {setCurrentDictionary} />
      {:else}
        <div class="featured">
          {#each featured_dictionaries as dictionary (dictionary.id)}
            <Button
              class="featured-button"
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
        class="back-button"
        onclick={() => (selectedDictionaryId = null)}>
        <IconFa6SolidChevronLeft class="icon-inline rtl-x-flip" />
        <div style="width: 0.25rem"></div>
        {page.data.t('misc.back')}
      </button>
      {#await import('$lib/components/home/SelectedDict.svelte') then { default: SelectedDict }}
        <SelectedDict dictionary={selectedDictionary} />
      {/await}
    {/if}
  </div>
  <div class="map-wrap">
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
      {#if auth_user.admin_level >= 1}
        <ShowHide>
          {#snippet children({ show, toggle })}
            <CustomControl position="bottom-right">
              <button type="button" class="toggle-private" onclick={toggle}>Toggle Private</button>
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

<div class="cta-band">

  <div class="banner-text">
    {page.data.t('home.main_banner')}
  </div>

  <div style="text-align: center">
    <Button
      href="/dictionaries"
      color="black"
      size="lg"
      class="list-button">
      <IconFaSolidList class="icon-inline" style="margin-top: -0.25rem" />
      {page.data.t('home.list_of_dictionaries')}
    </Button>
  </div>
</div>

<div class="divider"></div>

<div class="create-cta">
  <Button href="/create-dictionary" size="lg" color="black" form="filled">
    <IconFaSolidPlus class="icon-inline" style="margin-top: -0.3125rem" />
    {page.data.t('create.create_new_dictionary')}
  </Button>
</div>

<Footer />

<style>
  .home-layout {
    display: flex;
    flex-direction: column;
  }

  .sidebar {
    padding-left: 0.5rem;
    padding-right: 0.5rem;
    display: flex;
    flex-direction: column;
  }

  .featured {
    display: flex;
    flex-direction: column;
  }

  @media (max-width: 767.9px) {
    .featured {
      display: none;
    }
  }

  .featured :global(.featured-button) {
    margin-bottom: 0.25rem;
  }

  .back-button {
    display: flex;
    align-items: center;
    padding: 0.5rem;
    margin-left: -0.25rem;
    margin-right: -0.25rem;
    border-radius: 0.25rem;
  }

  .back-button:hover {
    background-color: color-mix(in srgb, var(--background), var(--color) 10%); /* ≈ gray-200 */
  }

  .map-wrap {
    position: relative;
    height: 50vh;
  }

  @media (min-width: 768px) {
    .home-layout {
      flex-direction: row;
    }

    .sidebar {
      width: 18rem;
    }

    .map-wrap {
      height: 70vh;
      flex-grow: 1;
    }
  }

  .map-wrap :global(.toggle-private) {
    white-space: nowrap;
    width: 90px !important;
    padding-left: 0.5rem;
    padding-right: 0.5rem;
  }

  .cta-band {
    width: 100%;
    background-color: color-mix(in srgb, var(--background), var(--color) 10%); /* ≈ gray-200 */
    text-align: center;
  }

  .banner-text {
    margin: auto;
    padding: 1.5rem;
    font-size: 1.5rem;
    line-height: 2rem;
    font-weight: 600;
    text-align: center;
    max-width: 72rem;
  }

  @media (min-width: 640px) {
    .banner-text {
      padding-left: 2rem;
      padding-right: 2rem;
    }
  }

  .cta-band :global(.list-button) {
    margin-bottom: 1.75rem;
  }

  .divider {
    border-top: 1px solid var(--border-color); /* ≈ gray-200 */
  }

  .create-cta {
    text-align: center;
    padding: 2rem 0.75rem;
  }
</style>

<SeoMetaTags
  title={page.data.t('misc.LD')}
  description="Living Dictionaries are language documentation tools that support endangered and under-represented languages. This online platform was created by Living Tongues Institute for Endangered Languages as a free multimedia resource for community activists and linguists who want to build digital dictionaries and phrasebooks."
  keywords="Minority Languages, Indigenous Languages, Language Documentation, Dictionary, Minority Community, Language Analysis, Language Education, Endangered Languages, Language Revitalization, Linguistics, Word Lists, Linguistic Analysis, Dictionaries, Living Dictionaries, Living Tongues, Under-represented Languages, Tech Resources, Language Sustainability, Language Resources, Diaspora Languages, Elicitation, Language Archives, Ancient Languages, World Languages, Obscure Languages, Little Known languages, Digital Dictionary, Dictionary Software, Free Software, Online Dictionary Builder, Dictionary with audio, dictionary with pronunciations, dictionary with speakers, dictionaries that you can edit" />
