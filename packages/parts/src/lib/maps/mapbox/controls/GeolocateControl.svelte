<script lang="ts">
  import { getContext, onDestroy, onMount } from 'svelte';
  import { contextKey } from '../contextKey';
  import type { Map } from 'mapbox-gl';

  const { getMap, getMapbox } = getContext(contextKey);
  const map: Map = getMap();
  const mapbox: typeof import('mapbox-gl') = getMapbox();

  export let position: 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left' = 'top-right';
  export let options = {};

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{
    geolocate: any;
    outofmaxbounds: any;
    trackuserlocationstart: any;
    trackuserlocationend: any;
    error: any;
  }>();

  const geolocate = new mapbox.GeolocateControl(options);
  map.addControl(geolocate, position);

  onMount(() => {
    geolocate.on('geolocate', (e) => dispatch('geolocate', e));
    geolocate.on('outofmaxbounds', (e) => dispatch('outofmaxbounds', e));
    geolocate.on('trackuserlocationstart', (e) => dispatch('trackuserlocationstart', e));
    geolocate.on('trackuserlocationend', (e) => dispatch('trackuserlocationend', e));
    geolocate.on('error', (e) => dispatch('error', e));
  });

  onDestroy(() => {
    geolocate?.off('geolocate', (e) => dispatch('geolocate', e));
    geolocate?.off('outofmaxbounds', (e) => dispatch('outofmaxbounds', e));
    geolocate?.off('trackuserlocationstart', (e) => dispatch('trackuserlocationstart', e));
    geolocate?.off('trackuserlocationend', (e) => dispatch('trackuserlocationend', e));
    geolocate?.off('error', (e) => dispatch('error', e));
    map?.removeControl(geolocate);
  });

  export function trigger() {
    geolocate.trigger();
  }
</script>
