<script lang="ts">
  // https://docs.mapbox.com/api/maps/static-images
  // https://stackoverflow.com/questions/69287390/request-static-image-from-mapbox-with-polygon-via-url // use decodeURIComponent to read example

  import type { IPoint, IRegion } from '@living-dictionaries/types';
  import { shapeGeoJson } from './shapeGeoJson';

  export let points: IPoint[] = [];
  export let regions: IRegion[] = [];
  export let width = 300;
  export let height = 200;
  export let accessToken = import.meta.env.VITE_mapboxAccessToken as string;
  export let style = 'streets-v11';
  export let highDef = true;
  export let singlePointZoom = 3;

  $: geoJson = shapeGeoJson(points, regions);
  $: autoUrl = `https://api.mapbox.com/styles/v1/mapbox/${style}/static/geojson(${encodeURIComponent(
    JSON.stringify(geoJson)
  )})/auto/${width}x${height}${highDef ? '@2x' : ''}?logo=false&access_token=${accessToken}`;

  $: singlePointUrl =
    points.length === 1 &&
    regions.length === 0 &&
    `https://api.mapbox.com/styles/v1/mapbox/${style}/static/geojson(${encodeURIComponent(
      JSON.stringify(geoJson)
    )})/${points[0].coordinates.longitude},${
      points[0].coordinates.latitude
    },${singlePointZoom}/${width}x${height}${
      highDef ? '@2x' : ''
    }?logo=false&access_token=${accessToken}`;

  $: src = singlePointUrl || autoUrl;
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
