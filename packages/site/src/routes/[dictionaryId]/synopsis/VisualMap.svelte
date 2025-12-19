<script lang="ts">
  import type { Tables } from '@living-dictionaries/types'
  import Map from '$lib/components/maps/mapbox/map/Map.svelte'
  import Marker from '$lib/components/maps/mapbox/map/Marker.svelte'
  import NavigationControl from '$lib/components/maps/mapbox/controls/NavigationControl.svelte'
  import { page } from '$app/state'

  interface Props {
    coordinates: Tables<'dictionaries'>['coordinates'];
  }

  let { coordinates }: Props = $props();
</script>

{#if coordinates?.points?.[0]}
  <div class="text-sm font-medium text-gray-700 mb-1">{page.data.t('misc.map')}</div>
  <div class="h-240px">
    <Map
      lat={coordinates.points[0].coordinates.latitude}
      lng={coordinates.points[0].coordinates.longitude}>
      <NavigationControl />
      <Marker
        lat={coordinates.points[0].coordinates.latitude}
        lng={coordinates.points[0].coordinates.longitude}
        color="blue" />
    </Map>
  </div>
{/if}
