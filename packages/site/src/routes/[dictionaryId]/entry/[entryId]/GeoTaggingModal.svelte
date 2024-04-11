<script lang="ts">
  import { Button, Modal, ShowHide } from 'svelte-pieces'
  import type { Coordinates, IPoint, IRegion } from '@living-dictionaries/types'
  import { createEventDispatcher, onMount } from 'svelte'
  import type { LngLatFull } from '@living-dictionaries/types/coordinates.interface'
  import InitableShowHide from './InitableShowHide.svelte'
  import { flattenCoordinates } from './flattenCoordinates'
  import { page } from '$app/stores'
  import Map from '$lib/components/maps/mapbox/map/Map.svelte'
  import NavigationControl from '$lib/components/maps/mapbox/controls/NavigationControl.svelte'
  import ToggleStyle from '$lib/components/maps/mapbox/controls/ToggleStyle.svelte'
  import Marker from '$lib/components/maps/mapbox/map/Marker.svelte'
  import Popup from '$lib/components/maps/mapbox/map/Popup.svelte'
  import CoordinatesModal from '$lib/components/maps/CoordinatesModal.svelte'
  import RegionModal from '$lib/components/maps/RegionModal.svelte'
  import Region from '$lib/components/maps/mapbox/map/Region.svelte'

  export let coordinates: Coordinates
  export let initialCenter: LngLatFull | undefined
  export let addPoint = false
  export let addRegion = false
  export let on_update: (new_value: Coordinates) => void

  let lng: number
  let lat: number
  const GPS_DECIMAL_PRECISION = 4

  const dispatch = createEventDispatcher<{
    close: boolean
  }>()

  function savePoints(points: IPoint[]) {
    on_update({ ...coordinates, points })
  }

  function saveRegions(regions: IRegion[]) {
    on_update({ ...coordinates, regions })
  }

  let mounted = false
  onMount(() => {
    if (coordinates?.points?.[0]) {
      const [{ coordinates: { longitude, latitude } }] = coordinates.points
      lng = longitude
      lat = latitude
    } else if (coordinates?.regions?.[0]) {
      const [{ coordinates: [{ longitude, latitude }] }] = coordinates.regions
      lng = longitude
      lat = latitude
    } else if (initialCenter) {
      ({ longitude: lng, latitude: lat } = initialCenter)
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        lng = +position.coords.longitude.toFixed(GPS_DECIMAL_PRECISION)
        lat = +position.coords.latitude.toFixed(GPS_DECIMAL_PRECISION)
      })
    }
    mounted = true
  })
</script>

<Modal on:close noscroll>
  <div class="h-sm">
    <Map pointsToFit={flattenCoordinates(coordinates)} {lng} {lat} zoom={6}>
      <NavigationControl />
      {#each coordinates?.points || [] as point, index (point)}
        <Marker
          lat={point.coordinates.latitude}
          lng={point.coordinates.longitude}>
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
                    const { points } = coordinates
                    points[index] = {
                      coordinates: {
                        longitude: detail.lng,
                        latitude: detail.lat,
                      },
                    }
                    savePoints(points)
                  }}
                  on:remove={() => {
                    const { points } = coordinates
                    points.splice(index, 1)
                    savePoints(points)
                  }}
                  on:close={toggle} />
              {/if}
            </ShowHide>
          </Popup>
        </Marker>
      {/each}

      {#each coordinates?.regions || [] as region, index (region)}
        <Region {region}>
          <ShowHide let:show let:toggle>
            <Button form="simple" size="sm" onclick={toggle}>
              <span class="i-octicon-pencil" />
            </Button>
            {#if show}
              <RegionModal
                initialCenter={initialCenter}
                {region}
                on:update={({ detail }) => {
                  const { regions } = coordinates
                  regions[index] = detail
                  saveRegions(regions)
                }}
                on:remove={() => {
                  const { regions } = coordinates
                  regions.splice(index, 1)
                  saveRegions(regions)
                }}
                on:close={toggle} />
            {/if}
          </ShowHide>
        </Region>
      {/each}

      <ToggleStyle />
    </Map>
    <div class="mt-1">
      {#if mounted}
        <InitableShowHide show={addPoint} let:show let:toggle>
          <Button onclick={toggle} color="black" size="sm">
            <span class="i-mdi-map-marker-plus mr-1" style="margin-top: -3px;" />
            {$page.data.t('create.select_coordinates')}
          </Button>
          {#if show}
            <CoordinatesModal
              {initialCenter}
              on:update={({ detail }) => {
                const newPoint = {
                  coordinates: { longitude: detail.lng, latitude: detail.lat },
                }
                const points = [...(coordinates?.points || []), newPoint]
                savePoints(points)
              }}
              on:close={toggle} />
          {/if}
        </InitableShowHide>

        <InitableShowHide show={addRegion} let:show let:toggle>
          <Button onclick={toggle} color="black" size="sm">
            <span class="i-mdi-map-marker-path mr-1" style="margin-top: -2px;" />
            {$page.data.t('create.select_region')}
          </Button>
          {#if show}
            <RegionModal
              initialCenter={initialCenter}
              region={null}
              on:update={({ detail }) => {
                const regions = [...(coordinates?.regions || []), detail]
                saveRegions(regions)
              }}
              on:close={toggle} />
          {/if}
        </InitableShowHide>
      {/if}
    </div>
  </div>

  <div class="modal-footer">
    <Button onclick={() => dispatch('close')} form="simple" color="black">
      {$page.data.t('misc.close')}
    </Button>
  </div>
</Modal>
