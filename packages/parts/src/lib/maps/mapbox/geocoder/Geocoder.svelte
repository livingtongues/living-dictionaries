<script lang="ts">
  // https://www.npmjs.com/package/@mapbox/mapbox-gl-geocoder
  import { getContext, onDestroy, onMount, createEventDispatcher } from 'svelte';
  import { contextKey } from '../contextKey';
  import { loadScriptOnce, loadStylesOnce } from '../asset-loader';
  import type { Map } from 'mapbox-gl';
  import type { Result, Results } from '@mapbox/mapbox-gl-geocoder';
  import { bindEvents } from '../event-bindings';

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

  const dispatch = createEventDispatcher<{
    clear: null;
    loading: any;
    result: Result;
    results: Results;
    error: string;
  }>();
  const handlers: Record<string, any> = {
    clear: () => dispatch('clear'),
    loading: ({ query }) => dispatch('loading', query),
    results: (e: Results) => dispatch('results', e),
    result: (e: Record<'result', Result>) => dispatch('result', e.result),
    error: ({ error }) => dispatch('error', error),
  };
  let unbind = () => {};

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

    unbind = bindEvents(geocoder, handlers);
  });

  onDestroy(() => {
    unbind();
    map?.removeControl(geocoder);
  });
</script>

<slot {geocoder} />
