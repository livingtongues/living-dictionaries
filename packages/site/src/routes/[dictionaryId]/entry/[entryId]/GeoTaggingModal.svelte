<script lang="ts">
  // import { t } from 'svelte-i18n';
  import { Modal } from 'svelte-pieces';
  import Map from '@living-dictionaries/parts/src/lib/maps/mapbox/map/Map.svelte';
// import { createEventDispatcher } from 'svelte';
</script>

<Modal on:close noscroll>
  <form style="height: 50vh;">
    <Map />
  </form>
</Modal>
