<script lang="ts">
  // https://docs.mapbox.com/api/maps/static-images
  // https://stackoverflow.com/questions/69287390/request-static-image-from-mapbox-with-polygon-via-url // use decodeURIComponent to read example
  // http://geojson.io/ to create GeoJSON easily
  // could use https://github.com/mapbox/mapbox-sdk-js/blob/main/docs/services.md#getstaticimage

  import type { IArea } from '@living-dictionaries/types';
  export let areas: IArea[];
  export let width = 500;
  export let height = 300;
  export let accessToken = import.meta.env.VITE_mapboxAccessToken as string;
  // 'pk.eyJ1Ijoicmlhc3RyYWQiLCJhIjoiY2pqcmJ5eXJ4MG9hYjNrbmZqNTdlMXIxOSJ9.k7qcqkM4mD2IDbUDjbt_bw';
  export let style = 'streets-v11';

  const geoJson = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              // [-97.354, 47.079],
              // [-97.345, 47.079],
              // [-97.345, 47.068],
              // [-97.355, 47.069],
              // [-97.366, 47.069],
              // [-97.366, 47.079],
              // [-97.354, 47.079],
              [-126.91406249999999, 40.97989806962013],
              [-118.828125, 36.03133177633187],
              [-115.6640625, 38.8225909761771],
              [-116.01562499999999, 42.8115217450979],
              [-126.91406249999999, 40.97989806962013],
            ],
          ],
        },
        properties: {},
      },
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: [-121.30004882812499, 42.867912483915305],
        },
      },
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: [-120.0146484375, 42.94838139765314],
        },
      },
    ],
  };

  $: src = `https://api.mapbox.com/styles/v1/mapbox/${style}/static/geojson(${encodeURIComponent(
    JSON.stringify(geoJson)
  )})/auto/${width}x${height}@2x?logo=false&access_token=${accessToken}`;
</script>

{#if src}
  {#await fetch(src) then response}
    {#if response.status === 200}
      <img alt="Map" {src} />
    {:else}
      {#await response.json() then body}
        <div class="text-red-600">
          Error code {response.status}: {body.message}
        </div>
      {/await}
    {/if}
  {:catch error}
    Error {error}
  {/await}
{/if}
