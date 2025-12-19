<script lang="ts">
  import { getContext, onMount } from 'svelte';
  import { mapKey, type MapKeyContext } from '../context';
  import type { IControl } from 'mapbox-gl';

  const { getMap } = getContext<MapKeyContext>(mapKey);
  const map = getMap();

  interface Props {
    position?: 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';
    children?: import('svelte').Snippet<[any]>;
  }

  let { position = 'top-right', children }: Props = $props();

  let el: HTMLDivElement = $state();

  onMount(() => {
    const customControl: IControl = {
      onAdd(_map) {
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
  {@render children?.({ map, })}
</div>
