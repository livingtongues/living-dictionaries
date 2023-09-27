<script lang="ts">
  // https://www.npmjs.com/package/@mapbox/mapbox-gl-geocoder
  import { getContext, onDestroy, onMount, createEventDispatcher } from 'svelte';
  import { mapKey, type MapKeyContext } from '../context';
  import { loadScriptOnce, loadStylesOnce } from 'sveltefirets';

  import type { Result, Results, GeocoderOptions } from '@mapbox/mapbox-gl-geocoder';
  import { bindEvents } from '../event-bindings';

  const { getMap, getMapbox } = getContext<MapKeyContext>(mapKey);
  const map = getMap();
  const mapbox = getMapbox();

  export let position: 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left' = 'top-left';
  export let options: Partial<GeocoderOptions> = {};
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
    'poi', // must include map to search points of interest
  ]; // https://docs.mapbox.com/api/search/#data-types
  export let placeholder = 'Search';
  export let value = null;
  export let customStylesheetUrl: string = undefined;

  type ResultOrUserCoordinates = Result | { user_coordinates: [number, number] };

  const dispatch = createEventDispatcher<{
    clear: boolean;
    loading: any;
    result: ResultOrUserCoordinates;
    resultCoordinates: { longitude: number, latitude: number };
    results: Results;
    error: string;
  }>();

  function handleGeocoderResult(result: ResultOrUserCoordinates): { longitude: number, latitude: number } {
    if ('user_coordinates' in result)
      return { longitude: result.user_coordinates[0], latitude: result.user_coordinates[1] };

    return { longitude: result.center[0], latitude: result.center[1] };
  }

  const handlers: Record<string, any> = {
    clear: () => dispatch('clear'),
    loading: ({ query }: {query: string}) => dispatch('loading', query),
    result: ({ result }: { result: ResultOrUserCoordinates }) => {
      dispatch('result', result)
      if (result) dispatch('resultCoordinates', handleGeocoderResult(result))
    },
    results: (e: Results) => dispatch('results', e),
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
      // @ts-ignore - types are not yet updated to 5.0.0 so they don't have enableGeolocation
      enableGeolocation: true,
      accessToken: mapbox.accessToken,
      // marker: false,
      mapboxgl: mapbox,
      types: types.join(','),
      placeholder,
    });
    map.addControl(geocoder, position);

    if (value)
      geocoder.setInput(value);


    unbind = bindEvents(geocoder, handlers);

    // keep Geolocate button from submitting form, can also be solved by wrapping Map in a form that preventsDefault
    const button = document.querySelector('[aria-label="Geolocate"]') as HTMLButtonElement;
    if (button) button.type = 'button';
  });

  onDestroy(() => {
    unbind();
    map?.removeControl(geocoder);
  });
</script>

<slot {geocoder} />
