<script lang="ts">
  import ShowHide from 'svelte-pieces/functions/ShowHide.svelte';
  import GeoJSONSource from '../sources/GeoJSONSource.svelte';
  import Layer from './Layer.svelte';
  import PopupOfMap from './PopupOfMap.svelte';
  import { polygonFeatureCoordinates } from '../../utils/polygonFromCoordinates';
  import type { IRegion } from '@living-dictionaries/types';
  import { getContext } from 'svelte';
  import type { Map } from 'mapbox-gl';
  import { mapKey } from '../context';
  import { points } from '@turf/helpers';
  import center from '@turf/center';

  const { getMap } = getContext(mapKey);
  const map: Map = getMap();

  export let region: IRegion;

  $: rCenter = (() => {
    const features = points(
      region.coordinates.map(({ longitude, latitude }) => [longitude, latitude])
    );
    const c = center(features);
    if (c?.geometry?.coordinates) return c.geometry.coordinates;
  })();
</script>

<ShowHide let:show let:toggle>
  <GeoJSONSource
    data={{
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: polygonFeatureCoordinates(region.coordinates),
      },
      properties: undefined,
    }}>
    <Layer
      options={{
        type: 'fill',
        paint: {
          'fill-color': '#0080ff',
          'fill-opacity': 0.5,
        },
      }}
      on:click={toggle}
      on:mouseenter={() => (map.getCanvas().style.cursor = 'pointer')}
      on:mouseleave={() => (map.getCanvas().style.cursor = '')} />
    <Layer
      options={{
        type: 'line',
        paint: {
          'line-color': '#555555',
          'line-width': 1,
        },
      }} />
  </GeoJSONSource>
  {#if show}
    <PopupOfMap lng={rCenter[0]} lat={rCenter[1]}>
      <slot />
    </PopupOfMap>
  {/if}
</ShowHide>
