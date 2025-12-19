<script lang="ts">
  import { run } from 'svelte/legacy';

  // https://docs.mapbox.com/api/maps/static-images
  // https://stackoverflow.com/questions/69287390/request-static-image-from-mapbox-with-polygon-via-url // use decodeURIComponent to read example

  import type { IPoint, IRegion } from '@living-dictionaries/types';
  import { shapeGeoJson } from './shapeGeoJson';
  import { PUBLIC_mapboxAccessToken } from '$env/static/public';

  interface Props {
    points?: IPoint[];
    regions?: IRegion[];
    width?: number;
    height?: number;
    accessToken?: any;
    style?: string;
    highDef?: boolean;
    singlePointZoom?: number;
  }

  let {
    points = [],
    regions = [],
    width = 300,
    height = 200,
    accessToken = PUBLIC_mapboxAccessToken,
    style = 'streets-v11',
    highDef = true,
    singlePointZoom = 3
  }: Props = $props();

  let geoJson = $derived(shapeGeoJson(points, regions));
  let urlFriendlyGeoJson = $derived(encodeURIComponent(JSON.stringify(geoJson)));
  let urlPrefix = $derived(`https://api.mapbox.com/styles/v1/mapbox/${style}/static/geojson(${urlFriendlyGeoJson})`);
  let urlSuffix = $derived(`${width}x${height}${highDef ? '@2x' : ''}?logo=false&access_token=${accessToken}`)

  let src = $state('');
  let isSinglePoint = $derived(points?.length === 1 && !regions?.length);
  run(() => {
    if (isSinglePoint) {
      const [{ coordinates: firstPoint }] = points
      const { longitude } = firstPoint;
      const { latitude } = firstPoint;
      src = `${urlPrefix}/${longitude},${latitude},${singlePointZoom}/${urlSuffix}`
    } else {
      src = `${urlPrefix}/auto/${urlSuffix}`
    }
  });
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

