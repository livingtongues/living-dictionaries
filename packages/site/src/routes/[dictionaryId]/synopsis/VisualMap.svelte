<script lang="ts">
  import Map from '$lib/components/maps/mapbox/map/Map.svelte'
  import Marker from '$lib/components/maps/mapbox/map/Marker.svelte'
  import NavigationControl from '$lib/components/maps/mapbox/controls/NavigationControl.svelte'
  import { page } from '$app/stores'

  export let coordinates: { longitude: number, latitude: number }
</script>

{#if coordinates}
  <div class="text-sm font-medium text-gray-700 mb-1">{$page.data.t('misc.map')}</div>
  <div class="h-240px">
    <Map
      lat={coordinates?.latitude}
      lng={coordinates?.longitude}>
      <NavigationControl />
      <Marker
        lat={coordinates?.latitude}
        lng={coordinates?.longitude}
        color="red" />
    </Map>
  </div>
{/if}
