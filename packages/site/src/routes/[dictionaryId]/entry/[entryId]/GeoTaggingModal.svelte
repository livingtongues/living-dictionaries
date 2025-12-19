<script lang="ts">
  import { Button, Modal, ShowHide } from '$lib/svelte-pieces'
  import type { Coordinates, IPoint, IRegion } from '@living-dictionaries/types'
  import { onMount } from 'svelte'
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

  interface Props {
    coordinates: Coordinates;
    initialCenter: LngLatFull | undefined;
    addPoint?: boolean;
    addRegion?: boolean;
    on_update: (new_value: Coordinates) => Promise<void>;
    on_close: () => void;
  }

  let {
    coordinates,
    initialCenter,
    addPoint = false,
    addRegion = false,
    on_update,
    on_close
  }: Props = $props();

  let lng: number = $state()
  let lat: number = $state()
  const GPS_DECIMAL_PRECISION = 4

  function savePoints(points: IPoint[]) {
    on_update({ ...coordinates, points })
  }

  function saveRegions(regions: IRegion[]) {
    on_update({ ...coordinates, regions })
  }

  let mounted = $state(false)
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

<Modal {on_close} noscroll>
  <div class="h-sm">
    <Map pointsToFit={flattenCoordinates(coordinates)} {lng} {lat} zoom={6}>
      <NavigationControl />
      {#each coordinates?.points || [] as point, index (point)}
        <Marker
          lat={point.coordinates.latitude}
          lng={point.coordinates.longitude}>
          <Popup>
            <ShowHide  >
              {#snippet children({ show, toggle })}
                            <Button form="simple" size="sm" onclick={toggle}>
                  <span class="i-octicon-pencil"></span>
                </Button>
                {#if show}
                  <CoordinatesModal
                    lng={point.coordinates.longitude}
                    lat={point.coordinates.latitude}
                    on_update={(detail) => {
                      const { points } = coordinates
                      points[index] = {
                        coordinates: {
                          longitude: detail.lng,
                          latitude: detail.lat,
                        },
                      }
                      savePoints(points)
                    }}
                    on_remove={() => {
                      const { points } = coordinates
                      points.splice(index, 1)
                      savePoints(points)
                    }}
                    on_close={toggle} />
                {/if}
                                        {/snippet}
                        </ShowHide>
          </Popup>
        </Marker>
      {/each}

      {#each coordinates?.regions || [] as region, index (region)}
        <Region {region}>
          <ShowHide  >
            {#snippet children({ show, toggle })}
                        <Button form="simple" size="sm" onclick={toggle}>
                <span class="i-octicon-pencil"></span>
              </Button>
              {#if show}
                <RegionModal
                  initialCenter={initialCenter}
                  {region}
                  on_update={(detail) => {
                    const { regions } = coordinates
                    regions[index] = detail
                    saveRegions(regions)
                  }}
                  on_remove={() => {
                    const { regions } = coordinates
                    regions.splice(index, 1)
                    saveRegions(regions)
                  }}
                  on_close={toggle} />
              {/if}
                                  {/snippet}
                    </ShowHide>
        </Region>
      {/each}

      <ToggleStyle />
    </Map>
    <div class="mt-1">
      {#if mounted}
        <InitableShowHide show={addPoint}  >
          {#snippet children({ show, toggle })}
                    <Button onclick={toggle} color="black" size="sm">
              <span class="i-mdi-map-marker-plus mr-1" style="margin-top: -3px;"></span>
              {$page.data.t('create.select_coordinates')}
            </Button>
            {#if show}
              <CoordinatesModal
                {initialCenter}
                on_update={(detail) => {
                  const newPoint = {
                    coordinates: { longitude: detail.lng, latitude: detail.lat },
                  }
                  const points = [...(coordinates?.points || []), newPoint]
                  savePoints(points)
                }}
                on_close={toggle} />
            {/if}
                            {/snippet}
                </InitableShowHide>

        <InitableShowHide show={addRegion}  >
          {#snippet children({ show, toggle })}
                    <Button onclick={toggle} color="black" size="sm">
              <span class="i-mdi-map-marker-path mr-1" style="margin-top: -2px;"></span>
              {$page.data.t('create.select_region')}
            </Button>
            {#if show}
              <RegionModal
                initialCenter={initialCenter}
                region={null}
                on_update={(detail) => {
                  const regions = [...(coordinates?.regions || []), detail]
                  saveRegions(regions)
                }}
                on_close={toggle} />
            {/if}
                            {/snippet}
                </InitableShowHide>
      {/if}
    </div>
  </div>

  <div class="modal-footer">
    <Button onclick={on_close} form="simple" color="black">
      {$page.data.t('misc.close')}
    </Button>
  </div>
</Modal>
