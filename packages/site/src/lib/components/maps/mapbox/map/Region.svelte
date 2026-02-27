<script lang="ts">
  import type { IRegion } from '@living-dictionaries/types'
  import { ShowHide } from '$lib/svelte-pieces'
  import center from '@turf/center'
  import { points } from '@turf/helpers'
  import { getContext } from 'svelte'
  import { polygonFeatureCoordinates } from '../../utils/polygonFromCoordinates'
  import { mapKey, type MapKeyContext } from '../context'
  import GeoJSONSource from '../sources/GeoJSONSource.svelte'
  import Layer from './Layer.svelte'
  import PopupOfMap from './PopupOfMap.svelte'

  const { getMap } = getContext<MapKeyContext>(mapKey)
  const map = getMap()

  interface Props {
    region: IRegion
    color?: string
    children?: import('svelte').Snippet
  }

  let { region, color = undefined, children }: Props = $props()

  let coordinatesArray
    = $derived(region?.coordinates.map(({ longitude, latitude }) => [longitude, latitude]) || [])
  let [lng, lat] = $derived(center(points(coordinatesArray)).geometry.coordinates)

  const children_render = $derived(children)
</script>

<ShowHide>
  {#snippet children({ show, toggle })}
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
            'fill-color': color || region.color || '#0080ff',
            'fill-opacity': 0.5,
          },
        }}
        onclick={toggle}
        onmouseenter={() => children && (map.getCanvas().style.cursor = 'pointer')}
        onmouseleave={() => (map.getCanvas().style.cursor = '')} />
      <Layer
        options={{
          type: 'line',
          paint: {
            'line-color': '#555555',
            'line-width': 1,
          },
        }} />
    </GeoJSONSource>
    {#if children && show}
      <PopupOfMap {lng} {lat}>
        {@render children_render?.()}
      </PopupOfMap>
    {/if}
  {/snippet}
</ShowHide>
