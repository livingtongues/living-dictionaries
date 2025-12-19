<script lang="ts">
  import { Button, ShowHide } from '$lib/svelte-pieces'
  import type { DictionaryView, IPoint, IRegion } from '@living-dictionaries/types'
  import type { LngLat } from 'mapbox-gl'
  import { page } from '$app/stores'
  import Map from '$lib/components/maps/mapbox/map/Map.svelte'
  import Marker from '$lib/components/maps/mapbox/map/Marker.svelte'
  import Popup from '$lib/components/maps/mapbox/map/Popup.svelte'
  import Region from '$lib/components/maps/mapbox/map/Region.svelte'
  import CoordinatesModal from '$lib/components/maps/CoordinatesModal.svelte'
  import RegionModal from '$lib/components/maps/RegionModal.svelte'
  import NavigationControl from '$lib/components/maps/mapbox/controls/NavigationControl.svelte'

  interface Props {
    on_update_points: (points: IPoint[]) => void;
    on_update_regions: (regions: IRegion[]) => void;
    dictionary: Partial<DictionaryView>;
  }

  let { on_update_points, on_update_regions, dictionary }: Props = $props();

  let first_longitude = $derived(dictionary.coordinates?.points?.[0]?.coordinates?.longitude)
  let first_latitude = $derived(dictionary.coordinates?.points?.[0]?.coordinates?.latitude)

  function addCoordinates({ detail: { lng, lat } }: { detail: { lng: number, lat: number } }) {
    const point: IPoint = { coordinates: { longitude: lng, latitude: lat } }
    const points = (dictionary.coordinates?.points && [...dictionary.coordinates.points, point]) || [point]
    on_update_points(points)
  }

  let mapClickCoordinates: LngLat = $state()
</script>

<div class="text-sm font-medium text-gray-700 mb-2">
  {$page.data.t('create.where_spoken')}
</div>

{#if first_longitude}
  <div class="text-xs text-gray-600 mb-2">
    {$page.data.t('create.map_instructions')}
  </div>
  <div class="h-240px">
    <Map
      lng={first_longitude}
      lat={first_latitude}
      on:click={({ detail }) => (mapClickCoordinates = detail)}>
      <NavigationControl />
      {#if mapClickCoordinates}
        <CoordinatesModal
          lng={+mapClickCoordinates.lng.toFixed(4)}
          lat={+mapClickCoordinates.lat.toFixed(4)}
          on_update={({ lat, lng }) => addCoordinates({ detail: { lng, lat } })}
          on_close={() => (mapClickCoordinates = null)}>
        </CoordinatesModal>
      {/if}

      {#each dictionary.coordinates.points || [] as point, index (point)}
        <Marker
          color={index === 0 ? 'blue' : 'black'}
          lat={point.coordinates.latitude}
          lng={point.coordinates.longitude}>
          <Popup>
            <ShowHide  >
              {#snippet children({ show, toggle })}
                            <Button form="simple" size="sm" onclick={toggle}>
                  <span class="i-octicon-pencil"></span>
                  {#if index === 0}
                    {$page.data.t('create.primary_coordinate')}
                  {/if}
                </Button>
                {#if show}
                  <CoordinatesModal
                    lng={point.coordinates.longitude}
                    lat={point.coordinates.latitude}
                    on_update={({ lat, lng }) => {
                      const { points } = dictionary.coordinates
                      points[index] = {
                        coordinates: { longitude: lng, latitude: lat },
                      }
                      on_update_points(points)
                    }}
                    on_remove={() => {
                      const { points } = dictionary.coordinates
                      points.splice(index, 1)
                      on_update_points(points)
                    }}
                    on_close={toggle}>
                  </CoordinatesModal>
                {/if}
                                        {/snippet}
                        </ShowHide>
          </Popup>
        </Marker>
      {/each}

      {#each dictionary.coordinates.regions || [] as region, index (region)}
        <Region {region}>
          <ShowHide  >
            {#snippet children({ show, toggle })}
                        <Button form="simple" size="sm" onclick={toggle}>
                <span class="i-octicon-pencil"></span>
              </Button>
              {#if show}
                <RegionModal
                  {region}
                  on_update={(detail) => {
                    const { regions } = dictionary.coordinates
                    regions[index] = detail
                    on_update_regions(regions)
                  }}
                  on_remove={() => {
                    const { regions } = dictionary.coordinates
                    regions.splice(index, 1)
                    on_update_regions(regions)
                  }}
                  on_close={toggle}>
                </RegionModal>
              {/if}
                                  {/snippet}
                    </ShowHide>
        </Region>
      {/each}
    </Map>
  </div>
{/if}

<div class="mt-1">
  <ShowHide  >
    {#snippet children({ show, toggle })}
        <Button
        onclick={toggle}
        color={first_longitude ? 'black' : 'primary'}
        size={first_longitude ? 'sm' : 'md'}>
        <span class="i-mdi-map-marker-plus mr-1" style="margin-top: -3px;"></span>
        {$page.data.t('create.select_coordinates')}
      </Button>
      {#if show}
        <CoordinatesModal
          initialCenter={{ ...(first_longitude && { longitude: first_longitude, latitude: first_latitude }) }}
          on_update={({ lat, lng }) => addCoordinates({ detail: { lng, lat } })}
          on_close={toggle} />
      {/if}
          {/snippet}
    </ShowHide>

  {#if first_longitude}
    <ShowHide  >
      {#snippet children({ show, toggle })}
            <Button onclick={toggle} color="black" size="sm">
          <span class="i-mdi-map-marker-path mr-1" style="margin-top: -2px;"></span>
          {$page.data.t('create.select_region')}
        </Button>
        {#if show}
          <RegionModal
            initialCenter={{ longitude: first_longitude, latitude: first_latitude }}
            region={null}
            on_update={(detail) => {
              const regions = (dictionary.coordinates.regions && [...dictionary.coordinates.regions, detail]) || [detail]
              on_update_regions(regions)
            }}
            on_close={toggle} />
        {/if}
                {/snippet}
        </ShowHide>
  {/if}
</div>
