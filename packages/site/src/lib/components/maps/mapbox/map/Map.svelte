<script lang="ts">
  // from https://github.com/beyonk-adventures/svelte-mapbox
  import { createEventDispatcher, onDestroy, onMount, setContext, tick } from 'svelte'
  import { loadScriptOnce, loadStylesOnce } from 'svelte-pieces'
  import type { ErrorEvent, EventData, LngLat, LngLatBoundsLike, LngLatLike, Map, MapboxOptions } from 'mapbox-gl'
  import { mapKey } from '../context'
  import { EventQueue } from '../queue'
  import { bindEvents } from '../event-bindings'
  import { getTimeZoneLongitude } from '../../utils/getTimeZoneLongitude'
  import { ADDED_FEATURE_ID_PREFIX } from '../../utils/randomId'
  import { PUBLIC_mapboxAccessToken } from '$env/static/public'

  export let map: Map = null
  export let version = 'v2.9.2'
  export let customStylesheetUrl: string = undefined
  export let accessToken = PUBLIC_mapboxAccessToken
  export let options: Partial<MapboxOptions> = {}
  export let zoom = 4
  export let style = 'mapbox://styles/mapbox/streets-v11?optimize=true' // 'Mapbox Streets' // light-v8, light-v9, light-v10, dark-v10, satellite-v9, streets-v11
  export let lng: number = undefined
  export let lat: number = undefined
  export let pointsToFit: number[][] = undefined

  let center: LngLatLike
  $: center = lng && lat ? [lng, lat] : [getTimeZoneLongitude() || -80, 10]

  let container: HTMLDivElement
  let mapbox: typeof import('mapbox-gl')
  const queue = new EventQueue()
  let ready = false

  setContext(mapKey, {
    getMap: () => map,
    getMapbox: () => mapbox,
  })

  const dispatch = createEventDispatcher<{
    ready: null
    dragend: LngLat
    moveend: LngLat
    click: LngLat
    zoomend: number
    error: ErrorEvent & EventData
  }>()

  // More events at https://docs.mapbox.com/mapbox-gl-js/api/map/#map-events
  const handlers: Record<string, any> = {
    dragend: () => dispatch('dragend', map.getCenter()),
    moveend: () => dispatch('moveend', map.getCenter()),
    click: (e) => {
      if (
        map
          .queryRenderedFeatures(e.point)
          .filter(f => f.source.startsWith(ADDED_FEATURE_ID_PREFIX))
          .length === 0
      ) {
        dispatch('click', e.lngLat)
      }
    },
    zoomend: () => dispatch('zoomend', map.getZoom()),
    error: (e: ErrorEvent & EventData) => dispatch('error', e),
    load: () => dispatch('ready') && (ready = true),
  // drag: () => dispatch('drag', map.getCenter()),
  }
  let unbind: () => void

  onMount(async () => {
    await loadScriptOnce(
      `//api.mapbox.com/mapbox-gl-js/${version}/mapbox-gl.js`,
    )
    await loadStylesOnce(
      `//api.mapbox.com/mapbox-gl-js/${version}/mapbox-gl.css`,
    )
    if (customStylesheetUrl) {
      await loadStylesOnce(customStylesheetUrl)
    }

    window.mapboxgl.accessToken = accessToken
    map = new window.mapboxgl.Map({
      ...options,
      container,
      style,
      center,
      zoom,
    })
    mapbox = window.mapboxgl
    queue.start(map)

    unbind = bindEvents(map, handlers)
  })

  onDestroy(async () => {
    unbind?.()

    queue.stop()
    await tick() // allow controls to remove themselves from the map
    map?.remove?.()
  })

  // use via https://svelte.dev/tutorial/component-this
  export function fitBounds(bbox: LngLatBoundsLike, data = {}) {
    queue.send('fitBounds', [bbox, data])
  }

  export function flyTo(destination, data = {}) {
    queue.send('flyTo', [destination, data])
  }

  export function resize() {
    queue.send('resize')
  }

  export function setCenter(coords, data = {}) {
    queue.send('setCenter', [coords, data])
  }

  export function setZoom(value, data = {}) {
    queue.send('setZoom', [value, data])
  }

  export function getMap() {
    return map
  }

  export function getMapbox() {
    return mapbox
  }

  $: if (zoom) setZoom(zoom)
  $: if (center) setCenter(center)
  $: if (pointsToFit?.length) fitPoints()

  async function fitPoints() {
    if (pointsToFit.length === 1) {
      setCenter(pointsToFit[0])
      return
    }
    const { bbox, lineString } = await import('@turf/turf')
    const line = lineString(pointsToFit)
    const box = bbox(line) as LngLatBoundsLike
    map.fitBounds(box, {
      padding: { top: 10, bottom: 10, left: 10, right: 10 },
      maxZoom: 6,
    })
  }
</script>

<div bind:this={container}>
  {#if ready}
    <slot {map} />
  {:else}
    <div class="w-full h-full bg-gray-100 flex items-center justify-center">
      <span class="i-fa-solid-globe-asia text-6xl text-gray-300 animate-pulse" />
    </div>
  {/if}
</div>

<style>
  div {
    width: 100%;
    height: 100%;
    position: relative;
  }
</style>
