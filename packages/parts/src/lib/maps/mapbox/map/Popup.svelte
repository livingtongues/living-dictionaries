<script lang="ts">
  import { onMount, getContext, createEventDispatcher } from 'svelte';
  import { contextKey } from '../contextKey';
  import type { Popup, PopupOptions, Marker } from 'mapbox-gl';

  const { getMapbox } = getContext(contextKey);
  const mapbox: typeof import('mapbox-gl') = getMapbox();

  export let closeOnClick = false;
  export let closeOnMove = true;
  export let options: PopupOptions = {};
  export let offset = 10;
  export let label = 'Marker';
  export let open = false;
  export let marker: Marker;

  let popup: Popup;
  let container: HTMLDivElement;

  onMount(() => {
    popup = new mapbox.Popup({
      ...options,
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
    // const markerElement = marker.getElement();
    // markerElement.style.cursor = 'pointer';

    popup.on('open', () => (open = true));
    popup.on('close', () => (open = false));

    return () => {
      popup.off('open', () => (open = true));
      popup.off('close', () => (open = false));
      marker.setPopup(null);
      // const markerElement = marker.getElement();
      // if (markerElement) {
      //   markerElement.style.cursor = null;
      // }
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
