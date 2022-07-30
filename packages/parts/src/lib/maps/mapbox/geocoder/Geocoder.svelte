<script lang="ts">
  // https://www.npmjs.com/package/@mapbox/mapbox-gl-geocoder
  import { getContext, onDestroy, onMount } from 'svelte';
  import { contextKey } from '../contextKey';
  import { loadScriptOnce, loadStylesOnce } from '../asset-loader';
  import { bindEvents } from '../event-bindings';
  import type { Map } from 'mapbox-gl';
  import type { Result } from '@mapbox/mapbox-gl-geocoder';
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{ result: { result: Result } }>();

  const { getMap, getMapbox } = getContext(contextKey);
  const map: Map = getMap();
  const mapbox: typeof import('mapbox-gl') = getMapbox();

  export let position: 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left' = 'top-left';
  export let options = {};
  export let version = 'v5.0.0'; //4.7.4 or 5.0.0 https://github.com/mapbox/mapbox-gl-geocoder/releases
  export let types = [
    'country',
    'region',
    'postcode',
    'district',
    'place',
    'locality',
    'neighborhood',
    'address',
    'poi', // must include map to search these
  ]; // https://docs.mapbox.com/api/search/#data-types
  export let placeholder = 'Search';
  export let value = null;
  export let customStylesheetUrl: string = undefined;

  let dispatcher: HTMLDivElement;

  const handlers = {
    results: (el, ev) => {
      return ['results', ev];
    },
    result: (el, ev) => {
      return ['result', ev];
    },
    loading: (el, ev) => {
      return ['loading', ev];
    },
    error: (el, ev) => {
      return ['error', ev];
    },
    clear: (el, ev) => {
      return ['clear', ev];
    },
    load: (el) => {
      return ['ready', { geocoder: el }];
    },
  };

  let geocoder: MapboxGeocoder;
  let unbind = () => {};
  onMount(async () => {
    await loadScriptOnce(
      `//api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-geocoder/${version}/mapbox-gl-geocoder.min.js`
    );
    await loadStylesOnce(
      `//api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-geocoder/${version}/mapbox-gl-geocoder.css`
    );
    customStylesheetUrl && (await loadStylesOnce(customStylesheetUrl));
    geocoder = new window.MapboxGeocoder({
      ...options,
      // @ts-ignore - types are not yet updated to 5.0.0
      enableGeolocation: true,
      accessToken: mapbox.accessToken,
      mapboxgl: map,
      types: types.join(','),
      placeholder,
    });
    map.addControl(geocoder, position);
    if (value) {
      geocoder.setInput(value);
    }

    unbind = bindEvents(geocoder, handlers, mapbox, dispatcher);
  });

  onDestroy(() => {
    map?.removeControl(geocoder);
    unbind();
  });
</script>

<div bind:this={dispatcher} on:results on:result on:loading on:error on:clear on:load />

<style>
  div {
    display: none;
  }
</style>
