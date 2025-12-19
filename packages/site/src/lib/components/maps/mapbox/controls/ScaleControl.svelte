<script lang="ts">
  import { getContext, onDestroy } from 'svelte';
  import { mapKey, type MapKeyContext } from '../context';

  const { getMap, getMapbox } = getContext<MapKeyContext>(mapKey);
  const map = getMap();
  const mapbox = getMapbox();

  interface Props {
    position?: 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';
    maxWidth?: number;
    unit?: string;
    options?: any;
  }

  let {
    position = 'bottom-right',
    maxWidth = 80,
    unit = 'metric',
    options = {}
  }: Props = $props();

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
