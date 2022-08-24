<script lang="ts">
  import { getContext, onMount } from 'svelte';
  import { mapKey } from '../context';
  import type { Map, Style } from 'mapbox-gl';

  const { getMap } = getContext(mapKey);
  const map: Map = getMap();

  export let alternateStyle = 'mapbox://styles/mapbox/satellite-streets-v11?optimize=true'; // 'Mapbox Satellite Streets'
  let initialStyle: Style;

  onMount(() => {
    initialStyle = map.getStyle();
  });

  function toggleStyle() {
    const style = map.getStyle();
    if (style.name === initialStyle.name) {
      map.setStyle(alternateStyle);
    } else {
      map.setStyle(initialStyle);
    }
  }
</script>

<button
  on:click={toggleStyle}
  type="button"
  class="px-2 py-1 absolute rounded shadow bg-white"
  style="bottom: 40px; left: 8px; z-index: 1;">
  <span class="i-fa-solid-globe-asia" />
</button>
