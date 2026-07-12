<script lang="ts">
  import IconFaTrashO from '~icons/fa/trash-o'
  import { onMount } from 'svelte'
  import type { IRegion, LngLatFull } from '$lib/types'
  import Map from './mapbox/map/Map.svelte'
  import Geocoder from './mapbox/geocoder/Geocoder.svelte'
  import Marker from './mapbox/map/Marker.svelte'
  import ToggleStyle from './mapbox/controls/ToggleStyle.svelte'
  import NavigationControl from './mapbox/controls/NavigationControl.svelte'
  import GeoJSONSource from './mapbox/sources/GeoJSONSource.svelte'
  import { polygon_feature_coordinates } from './utils/polygon-from-coordinates'
  import { center_of_coordinates } from './utils/center-of-coordinates'
  import Layer from './mapbox/map/Layer.svelte'
  import { random_color } from './utils/random-color'
  import Popup from './mapbox/map/Popup.svelte'
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import Modal from '$lib/components/ui/Modal.svelte'
  import ReactiveSet from '$lib/components/ui/ReactiveSet.svelte'
  import { page } from '$app/state'

  interface Props {
    initialCenter?: LngLatFull
    region: IRegion
    on_update: (region: IRegion) => void
    on_remove?: () => void
    on_close: () => void
    children?: import('svelte').Snippet
  }

  const { initialCenter = undefined, region, on_update, on_remove, on_close, children }: Props = $props()
  const zoom = region ? 4 : 3

  let centerLng: number = $state()
  let centerLat: number = $state()

  onMount(() => {
    if (region) {
      [centerLng, centerLat] = center_of_coordinates(region.coordinates)
    } else if (initialCenter) {
      ({ longitude: centerLng, latitude: centerLat } = initialCenter)
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        centerLng = position.coords.longitude
        centerLat = position.coords.latitude
      })
    }
  })

  function handleGeocoderResult(result, add) {
    if (result?.user_coordinates?.[0]) {
      add({
        longitude: result.user_coordinates[0],
        latitude: result.user_coordinates[1],
      })
    } else { add({ longitude: result.center[0], latitude: result.center[1] }) }
  }

  function update(coordinates: IRegion['coordinates']) {
    on_update({ coordinates })
    on_close()
  }
  function removeRegion() {
    on_remove?.()
    on_close()
  }

  const children_render = $derived(children)
</script>

<ReactiveSet
  input={region?.coordinates || []}>
  {#snippet children({ value, add, size, remove })}
    {@const points = value as LngLatFull[]}
    <Modal {on_close} noscroll>
      {#snippet heading()}
        <span>
          {page.data.t('create.select_region')}
        </span>
      {/snippet}
      <form onsubmit={(e) => { e.preventDefault(); update(points) }}>
        <div style="height: 50vh;">
          <Map
            lng={centerLng}
            lat={centerLat}
            {zoom}
            on_click={({ lng, lat }) =>
              add({ longitude: lng, latitude: lat })}>
            {@render children_render?.()}
            <NavigationControl />
            <Geocoder
              options={{ marker: false }}
              placeholder={page.data.t('about.search')}
              on_result={result => handleGeocoderResult(result, add)}
              on_error={error => console.error(error)} />
            {#each Array.from(points) as point (point)}
              <Marker
                draggable
                on_dragend={({ lng, lat }) => {
                  remove(point)
                  add({ longitude: lng, latitude: lat })
                }}
                lng={point.longitude}
                lat={point.latitude}>
                <Popup>
                  <HeadlessButton style="color: var(--danger)" class="btn-ghost btn-sm" onclick={() => remove(point)}><IconFaTrashO /></HeadlessButton>
                </Popup>
              </Marker>
            {/each}
            {#if size > 2}
              <GeoJSONSource
                data={{
                  type: 'Feature',
                  geometry: {
                    type: 'Polygon',
                    coordinates: polygon_feature_coordinates(points),
                  },
                  properties: undefined,
                }}>
                <Layer
                  options={{
                    type: 'fill',
                    paint: {
                      'fill-color': random_color(),
                      'fill-opacity': 0.5,
                    },
                  }} />
                <Layer
                  options={{
                    type: 'line',
                    paint: {
                      'line-color': '#555555',
                      'line-width': 1,
                    },
                  }} />
              </GeoJSONSource>
            {/if}
            <ToggleStyle />
          </Map>
        </div>

        <div class="modal-footer">
          <HeadlessButton class="btn-ghost btn-default" onclick={on_close}>
            {page.data.t('misc.cancel')}
          </HeadlessButton>
          <HeadlessButton style="color: var(--danger)" class="btn-ghost btn-default" onclick={removeRegion}>
            {page.data.t('misc.remove')}
          </HeadlessButton>
          <HeadlessButton class="btn-primary btn-default" type="submit" disabled={size < 3}>
            {page.data.t('misc.save')}
          </HeadlessButton>
        </div>
      </form>
    </Modal>
  {/snippet}
</ReactiveSet>
