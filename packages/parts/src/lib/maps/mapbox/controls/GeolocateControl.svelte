<script lang="ts">
  import { getContext, onDestroy, onMount } from 'svelte';
  import { contextKey } from '../contextKey';
  import { bindEvents } from '../event-bindings';
  import type { Map } from 'mapbox-gl';

  const { getMap, getMapbox } = getContext(contextKey);
  const map: Map = getMap();
  const mapbox: typeof import('mapbox-gl') = getMapbox();

  export let position: 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left' = 'top-right';
  export let options = {};

  let dispatcher: HTMLDivElement;

  const handlers = {
    error: (el, ev) => {
      return ['error', ev];
    },
    geolocate: (el, ev) => {
      return ['geolocate', ev];
    },
    outofmaxbounds: (el, ev) => {
      return ['outofmaxbounds', ev];
    },
    trackuserlocationend: (el, ev) => {
      return ['trackuserlocationend', ev];
    },
    trackuserlocationstart: (el, ev) => {
      return ['trackuserlocationstart', ev];
    },
  };

  const geolocate = new mapbox.GeolocateControl(options);
  map.addControl(geolocate, position);

  onMount(() => {
    return bindEvents(geolocate, handlers, mapbox, dispatcher);
  });

  onDestroy(() => {
    map?.removeControl(geolocate);
  });

  export function trigger() {
    geolocate.trigger();
  }
</script>

<div
  bind:this={dispatcher}
  on:error
  on:geolocate
  on:outofmaxbounds
  on:trackuserlocationend
  on:trackuserlocationstart />

<style>
  div {
    display: none;
  }
</style>
