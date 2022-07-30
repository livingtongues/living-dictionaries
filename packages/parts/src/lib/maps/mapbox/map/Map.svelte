<script lang="ts">
  // from https://github.com/beyonk-adventures/svelte-mapbox
  import { setContext, onDestroy, createEventDispatcher } from 'svelte';
  import { contextKey } from '../contextKey';
  import action from './map-action';
  import { EventQueue } from '../queue';
  import type { LngLatLike, MapboxOptions, Map } from 'mapbox-gl';

  export let map: Map = null;
  export let version = 'v2.9.2';
  export let center: LngLatLike = [-95, 38.907]; // USA
  export let zoom = 2;
  export let zoomRate = 1;
  export let wheelZoomRate = 1;
  export let options: Partial<MapboxOptions> = {};
  export let accessToken = import.meta.env.VITE_mapboxAccessToken as string;
  export let customStylesheetUrl: string = undefined;
  export let style = 'mapbox://styles/mapbox/streets-v11?optimize=true'; // light-v8, light-v9, light-v10, dark-v10, satellite-v9, streets-v11

  const dispatch = createEventDispatcher();

  setContext(contextKey, {
    getMap: () => map,
    getMapbox: () => mapbox,
  });

  let container: HTMLElement;
  let mapbox: typeof import('mapbox-gl');

  const optionsWithDefaults = {
    ...options,
    accessToken,
    container,
    style,
    center,
    zoom,
    zoomRate,
    wheelZoomRate,
    version,
    customStylesheetUrl,
    map,
  };

  const queue = new EventQueue();

  function init({ detail }) {
    map = detail.map;
    mapbox = detail.mapbox;
    queue.start(map);
    dispatch('ready');
  }

  onDestroy(() => {
    queue.stop();
    map = undefined;
  });

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

  export function addControl(control, position = 'top-right') {
    queue.send('addControl', [control, position]);
  }

  export function getMap() {
    return map;
  }

  export function getMapbox() {
    return mapbox;
  }

  $: zoom && setZoom(zoom);
</script>

<div
  use:action={optionsWithDefaults}
  on:ready={init}
  on:recentre
  on:dragend
  on:click
  on:zoomstart
  on:zoom
  on:zoomend
  on:drag>
  {#if map}
    <slot />
  {/if}
</div>

<style>
  div {
    width: 100%;
    height: 100%;
  }
</style>
