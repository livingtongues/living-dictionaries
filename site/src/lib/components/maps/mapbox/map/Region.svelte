<script lang="ts">
  import type { IRegion } from '$lib/types'
  import { getContext } from 'svelte'
  import { mapKey } from '../context'
  import type { MapKeyContext } from '../context'
  import { polygonFeatureCoordinates } from '../../utils/polygonFromCoordinates'
  import { centerOfCoordinates } from '../../utils/centerOfCoordinates'
  import GeoJSONSource from '../sources/GeoJSONSource.svelte'
  import PopupOfMap from './PopupOfMap.svelte'
  import Layer from './Layer.svelte'
  import ShowHide from '$lib/components/ui/LegacyShowHide.svelte'

  const { getMap } = getContext<MapKeyContext>(mapKey)
  const map = getMap()

  interface Props {
    region: IRegion
    color?: string
    children?: import('svelte').Snippet
  }

  const { region, color = undefined, children }: Props = $props()

  const [lng, lat] = $derived(centerOfCoordinates(region?.coordinates || []))

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
        on:click={toggle}
        on:mouseenter={() => children && (map.getCanvas().style.cursor = 'pointer')}
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
    {#if children && show}
      <PopupOfMap {lng} {lat}>
        {@render children_render?.()}
      </PopupOfMap>
    {/if}
  {/snippet}
</ShowHide>
