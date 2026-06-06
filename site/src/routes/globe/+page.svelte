<script lang="ts">
  import type { DictionaryView } from '$lib/types'
  import { page } from '$app/state'
  import Canvas from '$lib/components/globe/Canvas.svelte'
  import GlobeDictionaryPoints from '$lib/components/globe/DictionaryPoints.svelte'
  import Globe from '$lib/components/globe/Globe.svelte'
  import Zoomer from '$lib/components/globe/Zoomer.svelte'
  import MyDictionaries from '$lib/components/home/MyDictionaries.svelte'
  import SearchDictionaries from '$lib/components/home/SearchDictionaries.svelte'
  import SelectedDict from '$lib/components/home/SelectedDict.svelte'
  import Footer from '$lib/components/shell/Footer.svelte'
  import Header from '$lib/components/shell/Header.svelte'
  import IconFa6SolidChevronLeft from '~icons/fa6-solid/chevron-left'

  let { data } = $props()
  const t = $derived(page.data.t)

  const public_dictionaries = $derived(data.public_dictionaries)
  const my_dictionaries = $derived(data.my_dictionaries)
  const all_dictionaries = $derived([...public_dictionaries, ...my_dictionaries])

  let selected_dictionary_id = $state<string | null>(null)
  const selected_dictionary = $derived(
    selected_dictionary_id ? all_dictionaries.find(dictionary => dictionary.id === selected_dictionary_id) : null,
  )

  const featured_names = ['Achi', 'GtaɁ', 'Gutob', 'Kihunde', 'Sora']
  const featured_dictionaries = $derived(public_dictionaries.filter(dictionary => featured_names.includes(dictionary.name)))

  let globe_component: Globe = $state()
  let globe_width = $state(0)
  let globe_height = $state(0)

  function set_current_dictionary(dictionary: DictionaryView) {
    selected_dictionary_id = dictionary.id
    const point = dictionary.coordinates?.points?.[0]
    if (point)
      globe_component?.rotate_to(point.coordinates.longitude, point.coordinates.latitude)
  }
</script>

<Header />

<div class="banner-note">
  Experimental SVG/canvas globe (work in progress). The homepage uses the Mapbox globe.
</div>

<div class="home-layout">
  <aside class="sidebar">
    {#if !selected_dictionary}
      <SearchDictionaries dictionaries={all_dictionaries} setCurrentDictionary={set_current_dictionary} />
      {#if my_dictionaries.length}
        <MyDictionaries {my_dictionaries} setCurrentDictionary={set_current_dictionary} />
      {:else}
        <div class="featured">
          {#each featured_dictionaries as dictionary (dictionary.id)}
            <button type="button" class="btn btn-default featured-button" onclick={() => set_current_dictionary(dictionary)}>
              {dictionary.name}
            </button>
          {/each}
        </div>
      {/if}
    {:else}
      <button type="button" class="back-button" onclick={() => (selected_dictionary_id = null)}>
        <IconFa6SolidChevronLeft class="rtl-flip" />
        {t('misc.back')}
      </button>
      <SelectedDict dictionary={selected_dictionary} />
    {/if}
  </aside>

  <div class="globe-wrap" bind:clientWidth={globe_width} bind:clientHeight={globe_height}>
    {#if globe_width > 0 && globe_height > 0}
      <Canvas width={globe_width} height={globe_height}>
        {#snippet children({ context })}
          <Globe
            bind:this={globe_component}
            width={globe_width}
            height={globe_height}
            initial_longitude={+data.user_longitude || 0}
            initial_latitude={+data.user_latitude || 20}>
            {#snippet children({ projection, is_moving })}
              <GlobeDictionaryPoints
                {projection}
                {is_moving}
                dictionaries={public_dictionaries}
                selected_dictionary_id={selected_dictionary_id ?? undefined}
                on_select={id => (selected_dictionary_id = id)} />
              {#if my_dictionaries.length}
                <GlobeDictionaryPoints
                  {projection}
                  {is_moving}
                  dictionaries={my_dictionaries}
                  type="personal"
                  selected_dictionary_id={selected_dictionary_id ?? undefined}
                  on_select={id => (selected_dictionary_id = id)} />
              {/if}
              <Zoomer
                {context}
                {projection}
                on_move_start={() => globe_component?.on_move_start()}
                on_move_end={() => globe_component?.on_move_end()} />
            {/snippet}
          </Globe>
        {/snippet}
      </Canvas>
    {/if}
  </div>
</div>

<Footer />

<style>
  .banner-note {
    padding: 0.5rem 0.75rem;
    background: var(--surface);
    color: var(--color-secondary);
    font-size: 0.8125rem;
    text-align: center;
  }
  .home-layout {
    display: flex;
    flex-direction: column;
  }
  .sidebar {
    display: flex;
    flex-direction: column;
    padding: 0 0.5rem;
  }
  .featured {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .featured-button {
    justify-content: flex-start;
    text-align: left;
  }
  .back-button {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem;
    margin: 0 -0.25rem 0.25rem;
    border: none;
    background: transparent;
    color: var(--color);
    cursor: pointer;
    border-radius: 0.375rem;
  }
  .back-button:hover {
    background: var(--surface);
  }
  .globe-wrap {
    position: relative;
    height: 50vh;
  }
  @media (min-width: 768px) {
    .home-layout {
      flex-direction: row;
    }
    .sidebar {
      width: 18rem;
      flex-shrink: 0;
    }
    .globe-wrap {
      height: 70vh;
      flex: 1;
    }
  }
  :global(#direction[dir='rtl'] .rtl-flip) {
    transform: scaleX(-1);
  }
</style>
