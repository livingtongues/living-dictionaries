<script lang="ts">
  import { run } from 'svelte/legacy';

  // from https://github.com/beyonk-adventures/svelte-mapbox
  import { createEventDispatcher, onDestroy, onMount, setContext, tick } from 'svelte'
  import { loadScriptOnce, loadStylesOnce } from '$lib/svelte-pieces'
  import type { ErrorEvent, EventData, LngLat, LngLatBoundsLike, LngLatLike, Map, MapboxOptions } from 'mapbox-gl'
  import { mapKey } from '../context'
  import { EventQueue } from '../queue'
  import { bindEvents } from '../event-bindings'
  import { getTimeZoneLongitude } from '../../utils/getTimeZoneLongitude'
  import { ADDED_FEATURE_ID_PREFIX } from '../../utils/randomId'
  import { PUBLIC_mapboxAccessToken } from '$env/static/public'

  interface Props {
    map?: Map;
    version?: string;
    customStylesheetUrl?: string;
    accessToken?: any;
    options?: Partial<MapboxOptions>;
    zoom?: number;
    style?: string; // 'Mapbox Streets' // light-v8, light-v9, light-v10, dark-v10, satellite-v9, streets-v11
    lng?: number;
    lat?: number;
    pointsToFit?: number[][];
    children?: import('svelte').Snippet<[any]>;
  }

  let {
    map = $bindable(null),
    version = 'v3.13.0',
    customStylesheetUrl = undefined,
    accessToken = PUBLIC_mapboxAccessToken,
    options = {},
    zoom = 4,
    style = 'mapbox://styles/mapbox/streets-v11?optimize=true',
    lng = undefined,
    lat = undefined,
    pointsToFit = undefined,
    children
  }: Props = $props();

  let center: LngLatLike = $state()

  let container: HTMLDivElement = $state()
  let mapbox: typeof import('mapbox-gl')
  const queue = new EventQueue()
  let ready = $state(false)

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
    load: () => { 
      // map.fitBounds(
      //   [
      //     [-180, -90], // Southwest corner
      //     [180, 90], // Northeast corner
      //   ],
      //   {
      //     // padding: 0, // Optional padding
      //     animate: false // Disable animation for smoother transition
      //   }
      // );
      // map.setCenter(center);
      dispatch('ready');
      (ready = true);
    },
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
  run(() => {
    center = lng && lat ? [lng, lat] : [getTimeZoneLongitude() || -80, 10]
  });
  run(() => {
    if (zoom) setZoom(zoom)
  });
  run(() => {
    if (center) setCenter(center)
  });
  run(() => {
    if (pointsToFit?.length) fitPoints()
  });
</script>

<div bind:this={container}>
  {#if ready}
    {@render children?.({ map, })}
  {:else}
    <div class="w-full h-full bg-gray-100 flex items-center justify-center">
      <span class="i-fa-solid-globe-asia text-6xl text-gray-300 animate-pulse"></span>
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
