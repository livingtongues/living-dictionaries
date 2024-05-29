<script lang="ts">
  import { Button, ShowHide } from 'svelte-pieces'
  import type { IDictionary, IPoint, IRegion } from '@living-dictionaries/types'
  import type { LngLat } from 'mapbox-gl'
  import { page } from '$app/stores'
  import Map from '$lib/components/maps/mapbox/map/Map.svelte'
  import Marker from '$lib/components/maps/mapbox/map/Marker.svelte'
  import Popup from '$lib/components/maps/mapbox/map/Popup.svelte'
  import Region from '$lib/components/maps/mapbox/map/Region.svelte'
  import CoordinatesModal from '$lib/components/maps/CoordinatesModal.svelte'
  import RegionModal from '$lib/components/maps/RegionModal.svelte'
  import NavigationControl from '$lib/components/maps/mapbox/controls/NavigationControl.svelte'

  export let can_edit = false
  export let on_update_coordinates: (coordinates: { longitude: number, latitude: number }) => void
  export let on_remove_coordinates: () => void
  export let on_update_points: (points: IPoint[]) => void
  export let on_update_regions: (regions: IRegion[]) => void
  export let dictionary: Partial<IDictionary>
  $: hasCoordinates = dictionary.coordinates?.latitude

  function addCoordinates({ detail }: { detail: { lng: number, lat: number } }) {
    if (hasCoordinates) {
      const point = {
        coordinates: { longitude: detail.lng, latitude: detail.lat },
      }
      const points = (dictionary.points && [...dictionary.points, point]) || [point]
      on_update_points(points)
    } else {
      on_update_coordinates({ longitude: detail.lng, latitude: detail.lat })
    }
  }

  let mapClickCoordinates: LngLat
</script>

{#if can_edit}
  <div class="text-sm font-medium text-gray-700 mb-2">
    {$page.data.t('create.where_spoken')}
  </div>

  {#if hasCoordinates}
    <div class="text-xs text-gray-600 mb-2">
      {$page.data.t('create.map_instructions')}
    </div>
    <div class="h-240px">
      <Map
        lng={dictionary.coordinates.longitude}
        lat={dictionary.coordinates.latitude}
        on:click={({ detail }) => (mapClickCoordinates = detail)}>
        <NavigationControl />
        {#if mapClickCoordinates}
          <CoordinatesModal
            lng={+mapClickCoordinates.lng.toFixed(4)}
            lat={+mapClickCoordinates.lat.toFixed(4)}
            on:update={addCoordinates}
            on:close={() => (mapClickCoordinates = null)}>
            <Marker
              lng={dictionary.coordinates.longitude}
              lat={dictionary.coordinates.latitude}
              color="blue">
              <Popup offset={30} open>{$page.data.t('create.primary_coordinate')}</Popup>
            </Marker>
          </CoordinatesModal>
        {/if}
        <Marker
          lat={dictionary.coordinates.latitude}
          lng={dictionary.coordinates.longitude}
          color="blue">
          <Popup>
            <ShowHide let:show let:toggle>
              <Button form="simple" size="sm" onclick={toggle}>
                <span class="i-octicon-pencil" />
              </Button>
              {#if show}
                <CoordinatesModal
                  lng={dictionary.coordinates.longitude}
                  lat={dictionary.coordinates.latitude}
                  canRemove={!dictionary.points?.length && !dictionary.regions?.length}
                  on:update={({ detail }) =>
                    on_update_coordinates({ longitude: detail.lng, latitude: detail.lat })}
                  on:remove={on_remove_coordinates}
                  on:close={toggle} />
              {/if}
            </ShowHide>
          </Popup>
        </Marker>

        {#each dictionary.points || [] as point, index (point)}
          <Marker lat={point.coordinates.latitude} lng={point.coordinates.longitude}>
            <Popup>
              <ShowHide let:show let:toggle>
                <Button form="simple" size="sm" onclick={toggle}>
                  <span class="i-octicon-pencil" />
                </Button>
                {#if show}
                  <CoordinatesModal
                    lng={point.coordinates.longitude}
                    lat={point.coordinates.latitude}
                    on:update={({ detail }) => {
                      const { points } = dictionary
                      points[index] = {
                        coordinates: { longitude: detail.lng, latitude: detail.lat },
                      }
                      on_update_points(points)
                    }}
                    on:remove={() => {
                      const { points } = dictionary
                      points.splice(index, 1)
                      on_update_points(points)
                    }}
                    on:close={toggle}>
                    <Marker
                      lng={dictionary.coordinates.longitude}
                      lat={dictionary.coordinates.latitude}
                      color="blue">
                      <Popup offset={30}>Primary coordinate</Popup>
                    </Marker>
                  </CoordinatesModal>
                {/if}
              </ShowHide>
            </Popup>
          </Marker>
        {/each}

        {#each dictionary.regions || [] as region, index (region)}
          <Region {region}>
            <ShowHide let:show let:toggle>
              <Button form="simple" size="sm" onclick={toggle}>
                <span class="i-octicon-pencil" />
              </Button>
              {#if show}
                <RegionModal
                  {region}
                  on:update={({ detail }) => {
                    const { regions } = dictionary
                    regions[index] = detail
                    on_update_regions(regions)
                  }}
                  on:remove={() => {
                    const { regions } = dictionary
                    regions.splice(index, 1)
                    on_update_regions(regions)
                  }}
                  on:close={toggle}>
                  <Marker
                    lng={dictionary.coordinates.longitude}
                    lat={dictionary.coordinates.latitude}
                    color="blue">
                    <Popup offset={30}>Primary coordinate</Popup>
                  </Marker>
                </RegionModal>
              {/if}
            </ShowHide>
          </Region>
        {/each}
      </Map>
    </div>
  {/if}

  <div class="mt-1">
    <ShowHide let:show let:toggle>
      <Button
        onclick={toggle}
        color={hasCoordinates ? 'black' : 'primary'}
        size={hasCoordinates ? 'sm' : 'md'}>
        <span class="i-mdi-map-marker-plus mr-1" style="margin-top: -3px;" />
        {$page.data.t('create.select_coordinates')}
      </Button>
      {#if show}
        <CoordinatesModal lng={dictionary?.coordinates?.longitude} lat={dictionary?.coordinates?.latitude} on:update={addCoordinates} on:close={toggle}>
          {#if hasCoordinates}
            <Marker
              lng={dictionary.coordinates.longitude}
              lat={dictionary.coordinates.latitude}
              color="blue">
              <Popup offset={30} open>{$page.data.t('create.map_instructions')}</Popup>
            </Marker>
          {/if}
        </CoordinatesModal>
      {/if}
    </ShowHide>

    {#if hasCoordinates}
      <ShowHide let:show let:toggle>
        <Button onclick={toggle} color="black" size="sm">
          <span class="i-mdi-map-marker-path mr-1" style="margin-top: -2px;" />
          {$page.data.t('create.select_region')}
        </Button>
        {#if show}
          <RegionModal
            region={null}
            on:update={({ detail }) => {
              const regions = (dictionary.regions && [...dictionary.regions, detail]) || [detail]
              on_update_regions(regions)
            }}
            on:close={toggle}>
            <Marker
              lng={dictionary.coordinates.longitude}
              lat={dictionary.coordinates.latitude}
              color="blue">
              <Popup offset={30} open>{$page.data.t('create.map_instructions')}</Popup>
            </Marker>
          </RegionModal>
        {/if}
      </ShowHide>
    {/if}
  </div>
{:else if dictionary.coordinates}
  <div class="text-sm font-medium text-gray-700 mb-1">{$page.data.t('misc.map')}</div>
  <div class="h-240px">
    <Map
      lat={dictionary.coordinates?.latitude}
      lng={dictionary.coordinates?.longitude}>
      <NavigationControl />
      <Marker
        lat={dictionary.coordinates?.latitude}
        lng={dictionary.coordinates?.longitude}
        color="red" />
    </Map>
  </div>
{/if}
