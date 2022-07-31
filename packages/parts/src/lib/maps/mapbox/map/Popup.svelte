<script lang="ts">
  import { onMount, getContext } from 'svelte';
  import { contextKey } from '../contextKey';
  import type { Popup, PopupOptions, Marker } from 'mapbox-gl';

  const { getMapbox } = getContext(contextKey);
  const mapbox: typeof import('mapbox-gl') = getMapbox();

  export let closeOnClick = true;
  export let closeOnMove = true;
  export let options: PopupOptions = {};
  export let offset = 15;
  export let label = 'Marker';
  export let marker: Marker;
  // export let startOpen = false;

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

    return () => {
      marker.setPopup(null);
    };
  });
</script>

<div bind:this={container}>
  <slot />
</div>
