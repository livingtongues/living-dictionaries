<script lang="ts">
  import { getContext, onDestroy } from 'svelte';
  import { mapKey, type MapKeyContext } from '../context';

  const { getMap, getMapbox } = getContext<MapKeyContext>(mapKey);
  const map = getMap();
  const mapbox = getMapbox();

  export let position: 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left' = 'top-right';
  export let showCompass = true;
  export let showZoom = true;
  export let visualizePitch = true;

  const nav = new mapbox.NavigationControl({
    showCompass,
    showZoom,
    visualizePitch,
  });
  map.addControl(nav, position);

  onDestroy(() => {
    map?.removeControl(nav);
  });
</script>
