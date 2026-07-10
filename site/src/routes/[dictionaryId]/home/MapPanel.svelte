<script lang="ts">
  import type { Coordinates, DictionaryView } from '$lib/types'
  import { page } from '$app/state'
  import Modal from '$lib/components/ui/Modal.svelte'
  import MapboxStatic from '$lib/components/maps/mapbox/static/MapboxStatic.svelte'
  import WhereSpoken from '$lib/components/settings/WhereSpoken.svelte'
  import Map from '$lib/components/maps/mapbox/map/Map.svelte'
  import Marker from '$lib/components/maps/mapbox/map/Marker.svelte'
  import Region from '$lib/components/maps/mapbox/map/Region.svelte'
  import NavigationControl from '$lib/components/maps/mapbox/controls/NavigationControl.svelte'
  import IconMdiPlus from '~icons/mdi/plus'

  interface Props {
    dictionary: DictionaryView
    is_manager: boolean
    update_dictionary: (change: { coordinates: Coordinates }) => Promise<void>
  }

  const { dictionary, is_manager, update_dictionary }: Props = $props()
  const t = $derived(page.data.t)

  const points = $derived(dictionary.coordinates?.points || [])
  const regions = $derived(dictionary.coordinates?.regions || [])
  const has_coordinates = $derived(!!points.length || !!regions.length)

  const points_to_fit = $derived([
    ...points.map(({ coordinates }) => [coordinates.longitude, coordinates.latitude]),
    ...regions.flatMap(region => region.coordinates.map(({ longitude, latitude }) => [longitude, latitude])),
  ])

  let show_modal = $state(false)

  async function save(change: Partial<Coordinates>) {
    try {
      await update_dictionary({ coordinates: { points, regions, ...change } })
    } catch (err) {
      alert(`${t('misc.error')}: ${err}`)
    }
  }
</script>

{#if has_coordinates}
  <button type="button" class="map map-button" title={t('create.where_spoken')} onclick={() => show_modal = true}>
    <MapboxStatic {points} {regions} width={480} height={280} single_point_zoom={4} alt={t('create.where_spoken')} />
  </button>
{:else if is_manager}
  <button type="button" class="map add-location" onclick={() => show_modal = true}>
    <IconMdiPlus style="font-size: 1.5rem" />
    <span>{t('dict_home.add_location')}</span>
  </button>
{/if}

{#if show_modal}
  <Modal class="map-modal" noscroll on_close={() => show_modal = false}>
    {#snippet heading()}
      <span>{t('create.where_spoken')}</span>
    {/snippet}
    {#if is_manager}
      <WhereSpoken
        {dictionary}
        show_title={false}
        on_update_points={async new_points => await save({ points: new_points })}
        on_update_regions={async new_regions => await save({ regions: new_regions })} />
    {:else}
      <div style="height: min(60vh, 30rem)">
        <Map
          lng={points[0]?.coordinates.longitude}
          lat={points[0]?.coordinates.latitude}
          pointsToFit={points_to_fit}>
          <NavigationControl />
          {#each points as point, index (point)}
            <Marker
              color={index === 0 ? 'blue' : 'black'}
              lat={point.coordinates.latitude}
              lng={point.coordinates.longitude} />
          {/each}
          {#each regions as region (region)}
            <Region {region} />
          {/each}
        </Map>
      </div>
    {/if}
  </Modal>
{/if}

<style>
  .map {
    min-height: 11rem;
    width: 100%;
    height: 100%;
    border-radius: 0.75rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    font-size: 0.875rem;
    color: var(--color-secondary);
    cursor: pointer;
  }

  .map-button {
    overflow: hidden;
    padding: 0;
    background: var(--surface);
    /* height caps when the panel sits alone in the grid; a stretched grid cell
       (paired with the about panel) overrides aspect-ratio via height: 100% */
    aspect-ratio: 12 / 7;
    max-height: 20rem;
  }

  .map-button :global(img) {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .map-button :global(.static-placeholder) {
    width: 100%;
    height: 100%;
  }

  .add-location {
    border: 2px dashed var(--border-color);
    background: none;
    transition: border-color 200ms, color 200ms;
  }

  .add-location:hover {
    border-color: var(--primary);
    color: var(--primary);
  }

  :global(.modal-card.map-modal) {
    max-width: 52rem;
  }
</style>
