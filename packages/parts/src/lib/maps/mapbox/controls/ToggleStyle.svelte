<script lang="ts">
  import { getContext } from 'svelte';
  import { contextKey } from '../contextKey';
  import type { Map } from 'mapbox-gl';

  const { getMap } = getContext(contextKey);
  const map: Map = getMap();

  function toggleStyle() {
    const style = map.getStyle();
    if (style.name === 'Mapbox Streets') {
      map.setStyle('mapbox://styles/mapbox/satellite-streets-v11?optimize=true');
    } else {
      map.setStyle('mapbox://styles/mapbox/streets-v11?optimize=true'); // style.name === "Mapbox Satellite Streets"
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
