<script lang="ts">
  import { Modal } from 'svelte-pieces';
  import Map from '@living-dictionaries/parts/src/lib/maps/mapbox/map/Map.svelte';
  // import { createEventDispatcher } from 'svelte';
  import type { Readable } from 'svelte/store';
  import { onMount } from 'svelte';
  export let t: Readable<any> = undefined;

  let centerLng:number;
  let centerLat:number;

  onMount(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        centerLng = position.coords.longitude;
        centerLat = position.coords.latitude;
      });
    }
  });
</script>

<Modal on:close noscroll>
  <form style="height: 50vh;">
    <Map lng={centerLng} lat={centerLat} />
  </form>
</Modal>
