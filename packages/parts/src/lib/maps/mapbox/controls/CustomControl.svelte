<script lang="ts">
  import { getContext, onMount } from "svelte";
  import { mapKey } from "../context";
  import type { Map, IControl } from 'mapbox-gl';
  
  const { getMap } = getContext(mapKey);
  const map: Map = getMap();
  
  export let position: 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left' = 'top-right';

  let el: HTMLDivElement;

  onMount(() => {
    const customControl: IControl = {
      onAdd(map) {
        return el;
      },
      onRemove() {},
    };
    map.addControl(customControl, position);
    return () => {
      map.removeControl(customControl);
    };
  });
</script>

<div bind:this={el} class="mapboxgl-ctrl mapboxgl-ctrl-group">
  <slot {map} />
</div>
