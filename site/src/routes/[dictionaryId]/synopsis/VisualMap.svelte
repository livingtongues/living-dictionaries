<script lang="ts">
  import type { Tables } from '$lib/types'
  import Map from '$lib/components/maps/mapbox/map/Map.svelte'
  import Marker from '$lib/components/maps/mapbox/map/Marker.svelte'
  import NavigationControl from '$lib/components/maps/mapbox/controls/NavigationControl.svelte'
  import { page } from '$app/state'

  interface Props {
    coordinates: Tables<'dictionaries'>['coordinates']
  }

  const { coordinates }: Props = $props()
</script>

{#if coordinates?.points?.[0]}
  <div class="section-label" style="margin-bottom: 0.25rem">{page.data.t('misc.map')}</div>
  <div style="height: 240px">
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

<style>
  .section-label {
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 500;
    color: color-mix(in srgb, var(--color) 85%, var(--background)); /* ≈ gray-700 */
  }
</style>
