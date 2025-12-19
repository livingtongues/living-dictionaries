<script lang="ts">
  // https://www.npmjs.com/package/@mapbox/mapbox-gl-geocoder
  import { createEventDispatcher, getContext, onDestroy, onMount } from 'svelte'
  import { loadScriptOnce, loadStylesOnce } from 'svelte-pieces'

  import type { GeocoderOptions, Result, Results } from '@mapbox/mapbox-gl-geocoder'
  import { type MapKeyContext, mapKey } from '../context'
  import { bindEvents } from '../event-bindings'

  const { getMap, getMapbox } = getContext<MapKeyContext>(mapKey)
  const map = getMap()
  const mapbox = getMapbox()

  interface Props {
    position?: 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';
    options?: Partial<GeocoderOptions>;
    version?: string; // 4.7.4 or 5.0.0 https://github.com/mapbox/mapbox-gl-geocoder/releases
    types?: any; // https://docs.mapbox.com/api/search/#data-types
    placeholder?: string;
    value?: any;
    customStylesheetUrl?: string;
    children?: import('svelte').Snippet<[any]>;
  }

  let {
    position = 'top-left',
    options = {},
    version = 'v5.0.0',
    types = [
    'country',
    'region',
    'postcode',
    'district',
    'place',
    'locality',
    'neighborhood',
    'address',
    'poi', // must include map to search points of interest
  ],
    placeholder = 'Search',
    value = null,
    customStylesheetUrl = undefined,
    children
  }: Props = $props();

  type ResultOrUserCoordinates = Result | { user_coordinates: [number, number] }

  const dispatch = createEventDispatcher<{
    clear: boolean
    loading: any
    result: ResultOrUserCoordinates
    resultCoordinates: { longitude: number, latitude: number }
    results: Results
    error: string
  }>()

  function handleGeocoderResult(result: ResultOrUserCoordinates): { longitude: number, latitude: number } {
    if ('user_coordinates' in result)
      return { longitude: result.user_coordinates[0], latitude: result.user_coordinates[1] }

    return { longitude: result.center[0], latitude: result.center[1] }
  }

  const handlers: Record<string, any> = {
    clear: () => dispatch('clear'),
    loading: ({ query }: { query: string }) => dispatch('loading', query),
    result: ({ result }: { result: ResultOrUserCoordinates }) => {
      dispatch('result', result)
      if (result) dispatch('resultCoordinates', handleGeocoderResult(result))
    },
    results: (e: Results) => dispatch('results', e),
    error: ({ error }) => dispatch('error', error),
  }

  let unbind: () => void
  let geocoder: MapboxGeocoder = $state()

  onMount(async () => {
    await loadScriptOnce(
      `//api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-geocoder/${version}/mapbox-gl-geocoder.min.js`,
    )
    await loadStylesOnce(
      `//api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-geocoder/${version}/mapbox-gl-geocoder.css`,
    )
    customStylesheetUrl && (await loadStylesOnce(customStylesheetUrl))
    geocoder = new window.MapboxGeocoder({
      ...options,
      // @ts-expect-error - types are not yet updated to 5.0.0 so they don't have enableGeolocation
      enableGeolocation: true,
      accessToken: mapbox.accessToken,
      // marker: false,
      mapboxgl: mapbox,
      types: types.join(','),
      placeholder,
    })
    map.addControl(geocoder, position)

    if (value)
      geocoder.setInput(value)

    unbind = bindEvents(geocoder, handlers)

    // keep Geolocate button from submitting form, can also be solved by wrapping Map in a form that preventsDefault
    const button = document.querySelector('[aria-label="Geolocate"]') as HTMLButtonElement
    if (button) button.type = 'button'
  })

  onDestroy(() => {
    unbind?.()
    map?.removeControl(geocoder)
  })
</script>

{@render children?.({ geocoder, })}
