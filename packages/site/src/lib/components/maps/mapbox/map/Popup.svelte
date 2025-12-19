<script lang="ts">
  // from https://gitlab.com/jailbreak/svelte-mapbox-gl
  import { onMount, getContext } from 'svelte';
  import { mapKey, markerKey } from '../context';
  import type { Popup, PopupOptions, Marker } from 'mapbox-gl';

  const { getMapbox } = getContext<{ getMapbox: () => typeof import('mapbox-gl') }>(mapKey);
  const mapbox = getMapbox();

  const { getMarker } = getContext<{ getMarker: () => Marker }>(markerKey);
  const marker = getMarker();

  interface Props {
    closeButton?: boolean;
    closeOnClick?: boolean;
    closeOnMove?: boolean;
    options?: PopupOptions;
    offset?: number;
    label?: string;
    open?: boolean;
    children?: import('svelte').Snippet;
  }

  let {
    closeButton = false,
    closeOnClick = true,
    closeOnMove = true,
    options = {},
    offset = 15,
    label = 'Marker',
    open = false,
    children
  }: Props = $props();
  // make my own close button

  let popup: Popup = $state();
  let container: HTMLDivElement = $state();

  onMount(() => {
    popup = new mapbox.Popup({
      ...options,
      closeButton,
      closeOnClick,
      closeOnMove,
      offset,
    });

    if (container.hasChildNodes())
      popup.setDOMContent(container);
    else
      popup.setText(label);


    marker.setPopup(popup);

    return () => {
      marker.setPopup(null);
    };
  });

  $effect(() => {
    if (popup) {
      if (open !== popup.isOpen())
        marker.togglePopup();

    }
  });
</script>

<div bind:this={container}>
  {@render children?.()}
</div>

<style>
  /* div .mapboxgl-popup-close-button {
    font-size: 30px;
    top: 2px;
    right: 2px;
  } */
  :global(div .mapboxgl-popup-content) {
    padding: 12px;
  }
</style>
