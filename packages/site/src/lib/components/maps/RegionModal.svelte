<script lang="ts">
  import type { IRegion } from '@living-dictionaries/types'
  import type { LngLatFull } from '@living-dictionaries/types/coordinates.interface'
  import type { Snippet } from 'svelte'
  import { page } from '$app/stores'
  import { Button, Modal, ReactiveSet } from '$lib/svelte-pieces'
  import center from '@turf/center'
  import { points } from '@turf/helpers'
  import { onMount } from 'svelte'
  import NavigationControl from './mapbox/controls/NavigationControl.svelte'
  import ToggleStyle from './mapbox/controls/ToggleStyle.svelte'
  import Geocoder from './mapbox/geocoder/Geocoder.svelte'
  import Layer from './mapbox/map/Layer.svelte'
  import Map from './mapbox/map/Map.svelte'
  import Marker from './mapbox/map/Marker.svelte'
  import Popup from './mapbox/map/Popup.svelte'
  import GeoJSONSource from './mapbox/sources/GeoJSONSource.svelte'
  import { polygonFeatureCoordinates } from './utils/polygonFromCoordinates'
  import { randomColor } from './utils/randomColor'

  interface Props {
    initialCenter?: LngLatFull
    region: IRegion | null
    on_update?: (detail: IRegion) => void
    on_remove?: () => void
    on_close: () => void
    children?: Snippet
  }

  let {
    initialCenter = undefined,
    region,
    on_update = undefined,
    on_remove = undefined,
    on_close,
    children: childrenSnippet,
  }: Props = $props()

  const zoom = region ? 4 : 3

  let centerLng: number = $state()
  let centerLat: number = $state()

  onMount(() => {
    if (region) {
      const features = points(
        region.coordinates.map(({ longitude, latitude }) => [longitude, latitude]),
      )
      const c = center(features)
      if (c?.geometry?.coordinates)
        [centerLng, centerLat] = c.geometry.coordinates
    } else if (initialCenter) {
      ({ longitude: centerLng, latitude: centerLat } = initialCenter)
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        centerLng = position.coords.longitude
        centerLat = position.coords.latitude
      })
    }
  })

  function handleGeocoderResult(result: any, add: (item: LngLatFull) => void) {
    if (result?.user_coordinates?.[0]) {
      add({
        longitude: result.user_coordinates[0],
        latitude: result.user_coordinates[1],
      })
    } else {
      add({ longitude: result.center[0], latitude: result.center[1] })
    }
  }

  function update(coordinates: IRegion['coordinates']) {
    on_update?.({ coordinates })
    on_close()
  }
  function removeRegion() {
    on_remove?.()
    on_close()
  }
</script>

<ReactiveSet
  input={region?.coordinates || []}>
  {#snippet children({ value: regionPoints, add, size, remove })}
    <Modal {on_close} noscroll>
      {#snippet heading()}
        <span>
          {$page.data.t('create.select_region')}
        </span>
      {/snippet}
      <form onsubmit={(e) => { e.preventDefault(); update(regionPoints) }}>
        <div style="height: 50vh;">
          <Map
            lng={centerLng}
            lat={centerLat}
            {zoom}
            on_click={({ lng, lat }) =>
              add({ longitude: lng, latitude: lat })}>
            {#if childrenSnippet}
              {@render childrenSnippet()}
            {/if}
            <NavigationControl />
            <Geocoder
              options={{ marker: false }}
              placeholder={$page.data.t('about.search')}
              on_result={result => handleGeocoderResult(result, add)}
              on_error={e => console.error(e)} />
            {#each regionPoints as point (point)}
              <Marker
                draggable
                on_dragend={({ lng, lat }) => {
                  remove(point)
                  add({ longitude: lng, latitude: lat })
                }}
                lng={point.longitude}
                lat={point.latitude}>
                <Popup>
                  <Button
                    form="simple"
                    size="sm"
                    color="red"
                    onclick={() => remove(point)}><span class="i-fa-trash-o"></span></Button>
                </Popup>
              </Marker>
            {/each}
            {#if size > 2}
              <GeoJSONSource
                data={{
                  type: 'Feature',
                  geometry: {
                    type: 'Polygon',
                    coordinates: polygonFeatureCoordinates(regionPoints),
                  },
                  properties: undefined,
                }}>
                <Layer
                  options={{
                    type: 'fill',
                    paint: {
                      'fill-color': randomColor(),
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
          <Button onclick={on_close} form="simple" color="black">
            {$page.data.t('misc.cancel')}
          </Button>
          <Button onclick={removeRegion} form="simple" color="red">
            {$page.data.t('misc.remove')}
          </Button>
          <Button type="submit" form="filled" disabled={size < 3}>
            {$page.data.t('misc.save')}
          </Button>
        </div>
      </form>
    </Modal>
  {/snippet}
</ReactiveSet>
