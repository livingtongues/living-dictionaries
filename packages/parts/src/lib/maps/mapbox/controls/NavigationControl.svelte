<script lang="ts">
  import { getContext, onDestroy } from 'svelte';
  import { mapKey } from '../context';
  import type { Map } from 'mapbox-gl';

  const { getMap, getMapbox } = getContext(mapKey);
  const map: Map = getMap();
  const mapbox: typeof import('mapbox-gl') = getMapbox();

  export let position: 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left' = 'top-right';
  export let showCompass = true;
  export let showZoom = true;
  export let visualizePitch = true;
  export let options = {};

  const nav = new mapbox.NavigationControl({
    ...options,
    showCompass,
    showZoom,
    visualizePitch,
  });
  map.addControl(nav, position);

  onDestroy(() => {
    map?.removeControl(nav);
  });
</script>
