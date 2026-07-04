<script lang="ts">
  import type { Coordinates, IPoint, IRegion, LngLatFull } from '$lib/types'
  import { onMount } from 'svelte'
  import InitableShowHide from './InitableShowHide.svelte'
  import { flattenCoordinates } from './flattenCoordinates'
  import Button from '$lib/components/ui/Button.svelte'
  import Modal from '$lib/components/ui/Modal.svelte'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import { page } from '$app/state'
  import Map from '$lib/components/maps/mapbox/map/Map.svelte'
  import NavigationControl from '$lib/components/maps/mapbox/controls/NavigationControl.svelte'
  import ToggleStyle from '$lib/components/maps/mapbox/controls/ToggleStyle.svelte'
  import Marker from '$lib/components/maps/mapbox/map/Marker.svelte'
  import Popup from '$lib/components/maps/mapbox/map/Popup.svelte'
  import CoordinatesModal from '$lib/components/maps/CoordinatesModal.svelte'
  import RegionModal from '$lib/components/maps/RegionModal.svelte'
  import Region from '$lib/components/maps/mapbox/map/Region.svelte'
  import IconOcticonPencil from '~icons/octicon/pencil'
  import IconMdiMapMarkerPlus from '~icons/mdi/map-marker-plus'
  import IconMdiMapMarkerPath from '~icons/mdi/map-marker-path'

  interface Props {
    coordinates: Coordinates
    initialCenter: LngLatFull | undefined
    addPoint?: boolean
    addRegion?: boolean
    on_update: (new_value: Coordinates) => Promise<void>
    on_close: () => void
  }

  const {
    coordinates,
    initialCenter,
    addPoint = false,
    addRegion = false,
    on_update,
    on_close,
  }: Props = $props()

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

<Modal on_close={on_close} noscroll>
  <div style="height: 24rem">
    <Map pointsToFit={flattenCoordinates(coordinates)} {lng} {lat} zoom={6}>
      <NavigationControl />
      {#each coordinates?.points || [] as point, index (point)}
        <Marker
          lat={point.coordinates.latitude}
          lng={point.coordinates.longitude}>
          <Popup>
            <ShowHide>
              {#snippet children({ show, toggle })}
                <Button form="simple" size="sm" onclick={toggle}>
                  <IconOcticonPencil class="icon-inline" />
                </Button>
                {#if show}
                  <CoordinatesModal
                    lng={point.coordinates.longitude}
                    lat={point.coordinates.latitude}
                    on_update={({ lng: new_lng, lat: new_lat }) => {
                      const { points } = coordinates
                      points[index] = {
                        coordinates: {
                          longitude: new_lng,
                          latitude: new_lat,
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
          <ShowHide>
            {#snippet children({ show, toggle })}
              <Button form="simple" size="sm" onclick={toggle}>
                <IconOcticonPencil class="icon-inline" />
              </Button>
              {#if show}
                <RegionModal
                  initialCenter={initialCenter}
                  {region}
                  on_update={(updated_region) => {
                    const { regions } = coordinates
                    regions[index] = updated_region
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
    <div style="margin-top: 0.25rem">
      {#if mounted}
        <InitableShowHide show={addPoint}>
          {#snippet children({ show, toggle })}
            <Button onclick={toggle} color="black" size="sm">
              <IconMdiMapMarkerPlus class="icon-inline" style="margin-right: 0.25rem; margin-top: -3px;" />
              {page.data.t('create.select_coordinates')}
            </Button>
            {#if show}
              <CoordinatesModal
                {initialCenter}
                on_update={({ lng: new_lng, lat: new_lat }) => {
                  const newPoint = {
                    coordinates: { longitude: new_lng, latitude: new_lat },
                  }
                  const points = [...(coordinates?.points || []), newPoint]
                  savePoints(points)
                }}
                on_close={toggle} />
            {/if}
          {/snippet}
        </InitableShowHide>

        <InitableShowHide show={addRegion}>
          {#snippet children({ show, toggle })}
            <Button onclick={toggle} color="black" size="sm">
              <IconMdiMapMarkerPath class="icon-inline" style="margin-right: 0.25rem; margin-top: -2px;" />
              {page.data.t('create.select_region')}
            </Button>
            {#if show}
              <RegionModal
                initialCenter={initialCenter}
                region={null}
                on_update={(new_region) => {
                  const regions = [...(coordinates?.regions || []), new_region]
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
      {page.data.t('misc.close')}
    </Button>
  </div>
</Modal>
