<script lang="ts">
  // from https://github.com/beyonk-adventures/svelte-mapbox
  import { onDestroy, onMount, setContext, tick } from 'svelte'
  import type { ErrorEvent, EventData, LngLat, LngLatBoundsLike, LngLatLike, Map, MapboxOptions } from 'mapbox-gl'
  import { mapKey } from '../context'
  import { EventQueue } from '../queue'
  import { bindEvents } from '../event-bindings'
  import { getTimeZoneLongitude } from '../../utils/getTimeZoneLongitude'
  import { ADDED_FEATURE_ID_PREFIX } from '../../utils/randomId'
  import { loadScriptOnce, loadStylesOnce } from '$lib/utils/load-once'
  import { log_event } from '$lib/debug/remote-log'
  import { page } from '$app/state'
  import { PUBLIC_mapboxAccessToken } from '$env/static/public'
  import IconFaSolidGlobeAsia from '~icons/fa-solid/globe-asia'

  interface Props {
    map?: Map
    version?: string
    customStylesheetUrl?: string
    accessToken?: any
    options?: Partial<MapboxOptions>
    zoom?: number
    style?: string // 'Mapbox Streets' // light-v8, light-v9, light-v10, dark-v10, satellite-v9, streets-v11
    lng?: number
    lat?: number
    pointsToFit?: number[][]
    on_ready?: () => void
    on_dragend?: (center: LngLat) => void
    on_moveend?: (center: LngLat) => void
    on_click?: (lng_lat: LngLat) => void
    on_zoomend?: (zoom: number) => void
    on_error?: (error: ErrorEvent & EventData) => void
    children?: import('svelte').Snippet<[any]>
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
    on_ready,
    on_dragend,
    on_moveend,
    on_click,
    on_zoomend,
    on_error,
    children,
  }: Props = $props()

  const center: LngLatLike = $derived(lng && lat ? [lng, lat] : [getTimeZoneLongitude() || -80, 10])

  let container: HTMLDivElement = $state()
  let mapbox: typeof import('mapbox-gl')
  const queue = new EventQueue()
  let ready = $state(false)
  // Set when `new mapboxgl.Map()` throws synchronously because WebGL can't init
  // (disabled / unsupported / GPU blocklist) — switches the placeholder to a
  // graceful "map unavailable" message instead of an endless pulse.
  let webgl_failed = $state(false)

  setContext(mapKey, {
    getMap: () => map,
    getMapbox: () => mapbox,
  })

  // More events at https://docs.mapbox.com/mapbox-gl-js/api/map/#map-events
  const handlers: Record<string, any> = {
    dragend: () => on_dragend?.(map.getCenter()),
    moveend: () => on_moveend?.(map.getCenter()),
    click: (e) => {
      if (
        map
          .queryRenderedFeatures(e.point)
          .filter(f => f.source.startsWith(ADDED_FEATURE_ID_PREFIX))
          .length === 0
      ) {
        on_click?.(e.lngLat)
      }
    },
    zoomend: () => on_zoomend?.(map.getZoom()),
    error: (e: ErrorEvent & EventData) => on_error?.(e),
    load: () => {
      on_ready?.()
      ready = true
    },
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
    try {
      map = new window.mapboxgl.Map({
        ...options,
        container,
        style,
        center,
        zoom,
      })
    } catch (err) {
      // Mapbox throws synchronously from `new Map()` when WebGL can't initialize
      // (disabled / unsupported / GPU blocklist). That means the user genuinely
      // cannot see the map, so log ONE clean message instead of letting the raw
      // Mapbox-internal stack bubble to the global handler as undiagnosable noise.
      // `warn`, not `error` — it's the user's GPU/browser, not an app fault — and
      // `classify-error` folds "WebGL unavailable" into known-noise so it never
      // counts as a real error on the dashboard. The placeholder shows a graceful
      // fallback message instead of pulsing forever.
      webgl_failed = true
      log_event({
        level: 'warn',
        message: 'Map failed to load (WebGL unavailable)',
        context: { reason: err instanceof Error ? err.message : String(err) },
      })
      return
    }
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
    const { bboxOfCoordinates } = await import('../../utils/bboxOfCoordinates')
    const box = bboxOfCoordinates(pointsToFit) as LngLatBoundsLike
    map.fitBounds(box, {
      padding: { top: 10, bottom: 10, left: 10, right: 10 },
      maxZoom: 6,
    })
  }
  $effect(() => {
    if (zoom) setZoom(zoom)
  })
  $effect(() => {
    if (center) setCenter(center)
  })
  $effect(() => {
    if (pointsToFit?.length) fitPoints()
  })
</script>

<div bind:this={container}>
  {#if ready}
    {@render children?.({ map })}
  {:else if webgl_failed}
    <div class="map-placeholder map-unavailable">
      <IconFaSolidGlobeAsia class="icon-inline globe-static" />
      <p>{page.data.t('map.webgl_unavailable')}</p>
    </div>
  {:else}
    <div class="map-placeholder">
      <IconFaSolidGlobeAsia class="icon-inline globe-pulse" />
    </div>
  {/if}
</div>

<style>
  div {
    width: 100%;
    height: 100%;
    position: relative;
  }

  .map-placeholder {
    background-color: var(--surface); /* ≈ gray-100 */
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .map-unavailable {
    flex-direction: column;
    gap: 0.75rem;
    padding: 1.5rem;
    text-align: center;
  }

  .map-unavailable p {
    max-width: 22rem;
    font-size: 0.875rem;
    line-height: 1.25rem;
    color: color-mix(in srgb, var(--color) 70%, var(--background));
  }

  .map-unavailable :global(.globe-static) {
    font-size: 3.75rem;
    color: color-mix(in srgb, var(--background), var(--color) 18%); /* ≈ gray-300 */
  }

  .map-placeholder :global(.globe-pulse) {
    font-size: 3.75rem;
    color: color-mix(in srgb, var(--background), var(--color) 18%); /* ≈ gray-300 */
    animation: map-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  @keyframes map-pulse {
    0%,
    100% {
      opacity: 1;
    }

    50% {
      opacity: 0.5;
    }
  }
</style>
