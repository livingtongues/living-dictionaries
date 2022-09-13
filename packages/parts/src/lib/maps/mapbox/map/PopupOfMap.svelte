<script lang="ts">
  // from https://gitlab.com/jailbreak/svelte-mapbox-gl
  import { onMount, getContext } from 'svelte';
  import { mapKey, type MapKeyContext } from '../context';
  import type { Popup, PopupOptions } from 'mapbox-gl';

  const { getMap, getMapbox } = getContext<MapKeyContext>(mapKey);
  const map = getMap();
  const mapbox = getMapbox();

  export let closeButton = false;
  export let closeOnClick = true;
  export let closeOnMove = true;
  export let options: PopupOptions = {};
  export let label = 'Popup';
  export let open = true;
  export let lng: number;
  export let lat: number;

  let popup: Popup;
  let container: HTMLDivElement;

  $: popup?.setLngLat({ lng, lat });

  onMount(() => {
    popup = new mapbox.Popup({
      ...options,
      closeButton,
      closeOnClick,
      closeOnMove,
    });

    if (container.hasChildNodes()) {
      popup.setDOMContent(container);
    } else {
      popup.setText(label);
    }

    return () => {
      popup.remove();
    };
  });

  $: if (popup) {
    if (open) {
      popup.addTo(map);
    } else {
      popup.remove();
    }
  }
</script>

<div bind:this={container}>
  <slot />
</div>

<style global>
  div .mapboxgl-popup-content {
    padding: 12px;
  }
</style>
