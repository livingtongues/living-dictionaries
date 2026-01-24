<script lang="ts">
  import { getContext, onDestroy } from 'svelte';
  import { mapKey, type MapKeyContext } from '../context';

  const { getMap, getMapbox } = getContext<MapKeyContext>(mapKey);
  const map = getMap();
  const mapbox = getMapbox();

  interface Props {
    position?: 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';
    showCompass?: boolean;
    showZoom?: boolean;
    visualizePitch?: boolean;
  }

  let {
    position = 'top-right',
    showCompass = true,
    showZoom = true,
    visualizePitch = true
  }: Props = $props();

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
