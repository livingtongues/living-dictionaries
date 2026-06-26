<script lang="ts">
  import { getContext, onDestroy } from 'svelte';
  import { mapKey, type MapKeyContext } from '../context';

  const { getMap, getMapbox } = getContext<MapKeyContext>(mapKey);
  const map = getMap();
  const mapbox = getMapbox();

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
