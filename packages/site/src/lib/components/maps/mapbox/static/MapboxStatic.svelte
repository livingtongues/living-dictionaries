<script lang="ts">
  // https://docs.mapbox.com/api/maps/static-images
  // https://stackoverflow.com/questions/69287390/request-static-image-from-mapbox-with-polygon-via-url // use decodeURIComponent to read example

  import type { IPoint, IRegion } from '@living-dictionaries/types';
  import { shapeGeoJson } from './shapeGeoJson';
  import { PUBLIC_mapboxAccessToken } from '$env/static/public';

  export let points: IPoint[] = [];
  export let regions: IRegion[] = [];
  export let width = 300;
  export let height = 200;
  export let accessToken = PUBLIC_mapboxAccessToken;
  export let style = 'streets-v11';
  export let highDef = true;
  export let singlePointZoom = 3;

  $: geoJson = shapeGeoJson(points, regions);
  $: urlFriendlyGeoJson = encodeURIComponent(JSON.stringify(geoJson));
  $: urlPrefix = `https://api.mapbox.com/styles/v1/mapbox/${style}/static/geojson(${urlFriendlyGeoJson})`;
  $: urlSuffix = `${width}x${height}${highDef ? '@2x' : ''}?logo=false&access_token=${accessToken}`

  let src = '';
  $: isSinglePoint = points?.length === 1 && !regions?.length;
  $: if (isSinglePoint) {
    const [{ coordinates: firstPoint }] = points
    const { longitude } = firstPoint;
    const { latitude } = firstPoint;
    src = `${urlPrefix}/${longitude},${latitude},${singlePointZoom}/${urlSuffix}`
  } else {
    src = `${urlPrefix}/auto/${urlSuffix}`
  }
</script>

{#if src}
  {#await fetch(src) then response}
    {#if response.status === 200}
      <img alt="Map" {src} />
    {:else}
      {#await response.json() then body}
        <div style="width: {highDef ? (width * 2) : width}px; height: {highDef ? height * 2 : height}px;" class="bg-gray-200 flex items-center justify-center max-w-full max-h-full text-red-600">
          Error code {response.status}: {body.message}
        </div>
      {/await}
    {/if}
  {:catch error}
    <div style="width: {highDef ? (width * 2) : width}px; height: {highDef ? height * 2 : height}px;" class="bg-gray-200 flex items-center justify-center max-w-full max-h-full">
      Error {error}
    </div>
  {/await}
{/if}

