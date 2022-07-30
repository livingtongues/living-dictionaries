<script lang="ts">
  // https://www.npmjs.com/package/@mapbox/mapbox-gl-geocoder
  import { getContext, onDestroy, onMount } from 'svelte';
  import { contextKey } from '../contextKey';
  import { loadScriptOnce, loadStylesOnce } from '../asset-loader';
  import type { Map } from 'mapbox-gl';
  import type { Result, Results } from '@mapbox/mapbox-gl-geocoder';

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

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{
    clear: null;
    loading: any;
    result: Result;
    results: Results;
    error: string;
  }>();

  let geocoder: MapboxGeocoder;
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
      // marker: false,
      mapboxgl: mapbox as unknown as Map, // types are wrong in say it should be map
      types: types.join(','),
      placeholder,
    });
    map.addControl(geocoder, position);

    if (value) {
      geocoder.setInput(value);
    }

    geocoder.on('clear', () => dispatch('clear'));
    geocoder.on('loading', ({ query }) => dispatch('loading', query));
    geocoder.on('results', (e) => dispatch('results', e));
    geocoder.on('result', ({ result }) => dispatch('result', result));
    geocoder.on('error', ({ error }) => dispatch('error', error));
  });

  onDestroy(() => {
    geocoder?.off('clear', () => dispatch('clear'));
    geocoder?.off('loading', ({ query }) => dispatch('loading', query));
    geocoder?.off('results', ({ results }) => dispatch('results', results));
    geocoder?.off('result', ({ result }) => dispatch('result', result));
    geocoder?.off('error', ({ error }) => dispatch('error', error));
    map?.removeControl(geocoder);
  });
</script>

<slot {geocoder} />
