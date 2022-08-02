<script lang="ts">
  // from https://github.com/beyonk-adventures/svelte-mapbox
  import { setContext, onDestroy, createEventDispatcher, onMount, tick } from 'svelte';
  import { contextKey } from '../contextKey';
  import { loadScriptOnce, loadStylesOnce } from '../asset-loader';
  import { EventQueue } from '../queue';
  import type { LngLatLike, MapboxOptions, Map, LngLat, ErrorEvent, EventData } from 'mapbox-gl';
  import { bindEvents } from '../event-bindings';

  export let map: Map = null;
  export let version = 'v2.9.2';
  export let customStylesheetUrl: string = undefined;
  export let accessToken = import.meta.env.VITE_mapboxAccessToken as string;

  export let options: Partial<MapboxOptions> = {};
  export let center: LngLatLike = [-95, 38.907]; // USA
  export let zoom = 2;
  export let style = 'mapbox://styles/mapbox/streets-v11?optimize=true'; // light-v8, light-v9, light-v10, dark-v10, satellite-v9, streets-v11

  setContext(contextKey, {
    getMap: () => map,
    getMapbox: () => mapbox,
  });

  let container: HTMLDivElement;
  let mapbox: typeof import('mapbox-gl');
  const queue = new EventQueue();
  let ready = false;

  const dispatch = createEventDispatcher<{
    ready: null;
    dragend: LngLat;
    moveend: LngLat;
    click: LngLat;
    zoomend: number;
    error: ErrorEvent & EventData;
  }>();

  // More events at https://docs.mapbox.com/mapbox-gl-js/api/map/#map-events
  const handlers: Record<string, any> = {
    dragend: () => dispatch('dragend', map.getCenter()),
    moveend: () => dispatch('moveend', map.getCenter()),
    click: ({ lngLat }) => dispatch('click', lngLat),
    zoomend: () => dispatch('zoomend', map.getZoom()),
    error: (e: ErrorEvent & EventData) => dispatch('error', e),
    load: () => dispatch('ready') && (ready = true),
    // drag: () => dispatch('drag', map.getCenter()),
  };
  let unbind = () => {};

  onMount(async () => {
    await loadScriptOnce(`//api.mapbox.com/mapbox-gl-js/${version}/mapbox-gl.js`);
    await loadStylesOnce(`//api.mapbox.com/mapbox-gl-js/${version}/mapbox-gl.css`);
    customStylesheetUrl && (await loadStylesOnce(customStylesheetUrl));

    window.mapboxgl.accessToken = accessToken;
    map = new window.mapboxgl.Map({
      ...options,
      container,
      style,
      center,
      zoom,
    });
    mapbox = window.mapboxgl;
    queue.start(map);

    unbind = bindEvents(map, handlers);
  });

  onDestroy(async () => {
    unbind();

    queue.stop();
    await tick(); // allow controls to remove themselves from the map
    map?.remove && map.remove();
  });

  // use via https://svelte.dev/tutorial/component-this
  export function fitBounds(bbox, data = {}) {
    queue.send('fitBounds', [bbox, data]);
  }

  export function flyTo(destination, data = {}) {
    queue.send('flyTo', [destination, data]);
  }

  export function resize() {
    queue.send('resize');
  }

  export function setCenter(coords, data = {}) {
    queue.send('setCenter', [coords, data]);
  }

  export function setZoom(value, data = {}) {
    queue.send('setZoom', [value, data]);
  }

  export function getMap() {
    return map;
  }

  export function getMapbox() {
    return mapbox;
  }

  $: zoom && setZoom(zoom);
</script>

<div bind:this={container}>
  {#if ready}
    <slot />
  {/if}
</div>

<style>
  div {
    width: 100%;
    height: 100%;
    position: relative;
  }
</style>
