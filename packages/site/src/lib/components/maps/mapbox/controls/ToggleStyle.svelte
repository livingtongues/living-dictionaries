<script lang="ts">
  import { getContext, onMount } from 'svelte';
  import { mapKey, type MapKeyContext } from '../context';
  import type { Style } from 'mapbox-gl';

  const { getMap } = getContext<MapKeyContext>(mapKey);
  const map = getMap();

  export let alternateStyle = 'mapbox://styles/mapbox/satellite-streets-v12?optimize=true'; // 'Mapbox Satellite Streets'
  let initialStyle: Style;

  onMount(() => {
    initialStyle = map.getStyle();
  });

  function toggleStyle() {
    const style = map.getStyle();
    if (style.name === initialStyle.name)
      map.setStyle(alternateStyle);
    else
      map.setStyle(initialStyle);

  }
</script>

<button
  on:click={toggleStyle}
  type="button"
  class="px-2 py-1 absolute rounded shadow bg-white"
  style="bottom: 40px; left: 8px; z-index: 1;">
  <span class="i-fa-solid-globe-asia" />
</button>
