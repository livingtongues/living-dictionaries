<script lang="ts">
  // from https://gitlab.com/jailbreak/svelte-mapbox-gl
  import { onMount, getContext } from 'svelte';
  import { mapKey } from '../context';
  import type { Popup, PopupOptions, Marker } from 'mapbox-gl';

  const { getMapbox } = getContext(mapKey);
  const mapbox: typeof import('mapbox-gl') = getMapbox();

  export let closeButton = false;
  export let closeOnClick = true;
  export let closeOnMove = true;
  export let options: PopupOptions = {};
  export let offset = 15;
  export let label = 'Marker';
  export let marker: Marker;
  export let open = false;
  // make my own close button

  let popup: Popup;
  let container: HTMLDivElement;

  onMount(() => {
    popup = new mapbox.Popup({
      ...options,
      closeButton,
      closeOnClick,
      closeOnMove,
      offset,
    });

    if (container.hasChildNodes()) {
      popup.setDOMContent(container);
    } else {
      popup.setText(label);
    }

    marker.setPopup(popup);

    return () => {
      marker.setPopup(null);
    };
  });

  $: if (popup) {
    if (open !== popup.isOpen()) {
      marker.togglePopup();
    }
  }
</script>

<div bind:this={container}>
  <slot />
</div>

<style global>
  /* div .mapboxgl-popup-close-button {
    font-size: 30px;
    top: 2px;
    right: 2px;
  } */
  div .mapboxgl-popup-content {
    padding: 12px;
  }
</style>
