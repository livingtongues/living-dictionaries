<script lang="ts">
  import { getContext, onDestroy } from 'svelte';
  import { mapKey } from '../context';
  import type { Map } from 'mapbox-gl';

  const { getMap, getMapbox } = getContext(mapKey);
  const map: Map = getMap();
  const mapbox: typeof import('mapbox-gl') = getMapbox();

  export let position: 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left' = 'bottom-right';
  export let maxWidth = 80;
  export let unit = 'metric';
  export let options = {};

  const scale = new mapbox.ScaleControl({
    ...options,
    maxWidth,
    unit,
  });
  map.addControl(scale, position);

  onDestroy(() => {
    map?.removeControl(scale);
  });
</script>
