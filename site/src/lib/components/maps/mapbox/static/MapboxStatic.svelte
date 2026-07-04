<script lang="ts">
  // https://docs.mapbox.com/api/maps/static-images
  // https://stackoverflow.com/questions/69287390/request-static-image-from-mapbox-with-polygon-via-url // use decodeURIComponent to read example

  import type { IPoint, IRegion } from '$lib/types'
  import { shapeGeoJson } from './shapeGeoJson'
  import { PUBLIC_mapboxAccessToken } from '$env/static/public'

  interface Props {
    points?: IPoint[]
    regions?: IRegion[]
    width?: number
    height?: number
    accessToken?: any
    style?: string
    highDef?: boolean
    singlePointZoom?: number
  }

  const {
    points = [],
    regions = [],
    width = 300,
    height = 200,
    accessToken = PUBLIC_mapboxAccessToken,
    style = 'streets-v11',
    highDef = true,
    singlePointZoom = 3,
  }: Props = $props()

  const geoJson = $derived(shapeGeoJson(points, regions))
  const urlFriendlyGeoJson = $derived(encodeURIComponent(JSON.stringify(geoJson)))
  const urlPrefix = $derived(`https://api.mapbox.com/styles/v1/mapbox/${style}/static/geojson(${urlFriendlyGeoJson})`)
  const urlSuffix = $derived(`${width}x${height}${highDef ? '@2x' : ''}?logo=false&access_token=${accessToken}`)

  const isSinglePoint = $derived(points?.length === 1 && !regions?.length)
  const src = $derived.by(() => {
    if (isSinglePoint) {
      const [{ coordinates: { longitude, latitude } }] = points
      return `${urlPrefix}/${longitude},${latitude},${singlePointZoom}/${urlSuffix}`
    }
    return `${urlPrefix}/auto/${urlSuffix}`
  })
</script>

{#if src}
  {#await fetch(src) then response}
    {#if response.status === 200}
      <img alt="Map" {src} />
    {:else}
      {#await response.json() then body}
        <div style="width: {highDef ? (width * 2) : width}px; height: {highDef ? height * 2 : height}px;" class="static-placeholder error-text">
          Error code {response.status}: {body.message}
        </div>
      {/await}
    {/if}
  {:catch error}
    <div style="width: {highDef ? (width * 2) : width}px; height: {highDef ? height * 2 : height}px;" class="static-placeholder">
      Error {error}
    </div>
  {/await}
{/if}

<style>
  .static-placeholder {
    background-color: color-mix(in srgb, var(--background), var(--color) 10%); /* ≈ gray-200 */
    display: flex;
    align-items: center;
    justify-content: center;
    max-width: 100%;
    max-height: 100%;
  }

  .error-text {
    color: rgb(220 38 38); /* red-600 */
  }
</style>
