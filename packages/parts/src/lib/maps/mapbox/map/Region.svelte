<script lang="ts">
  import ShowHide from 'svelte-pieces/functions/ShowHide.svelte';
  import GeoJSONSource from '../sources/GeoJSONSource.svelte';
  import Layer from './Layer.svelte';
  import PopupOfMap from './PopupOfMap.svelte';
  import { polygonFeatureCoordinates } from '../../utils/polygonFromCoordinates';
  import type { IRegion } from '@living-dictionaries/types';
  import { getContext } from 'svelte';
  import { mapKey, type MapKeyContext } from '../context';
  import { points } from '@turf/helpers';
  import center from '@turf/center';

  const { getMap } = getContext<MapKeyContext>(mapKey);
  const map = getMap();

  export let region: IRegion;

  $: coordinatesArray =
    region?.coordinates.map(({ longitude, latitude }) => [longitude, latitude]) || [];
  $: [lng, lat] = center(points(coordinatesArray)).geometry.coordinates;
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
      on:mouseenter={() => $$slots.default && (map.getCanvas().style.cursor = 'pointer')}
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
  {#if $$slots.default && show}
    <PopupOfMap {lng} {lat}>
      <slot />
    </PopupOfMap>
  {/if}
</ShowHide>
