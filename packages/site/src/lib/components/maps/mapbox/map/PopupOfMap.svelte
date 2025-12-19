<script lang="ts">
  // from https://gitlab.com/jailbreak/svelte-mapbox-gl
  import { onMount, getContext } from 'svelte';
  import { mapKey, type MapKeyContext } from '../context';
  import type { Popup, PopupOptions } from 'mapbox-gl';

  const { getMap, getMapbox } = getContext<MapKeyContext>(mapKey);
  const map = getMap();
  const mapbox = getMapbox();

  interface Props {
    closeButton?: boolean;
    closeOnClick?: boolean;
    closeOnMove?: boolean;
    options?: PopupOptions;
    label?: string;
    open?: boolean;
    lng: number;
    lat: number;
    children?: import('svelte').Snippet;
  }

  let {
    closeButton = false,
    closeOnClick = true,
    closeOnMove = true,
    options = {},
    label = 'Popup',
    open = true,
    lng,
    lat,
    children
  }: Props = $props();

  let popup: Popup = $state();
  let container: HTMLDivElement = $state();

  $effect(() => {
    popup?.setLngLat({ lng, lat });
  });

  onMount(() => {
    popup = new mapbox.Popup({
      ...options,
      closeButton,
      closeOnClick,
      closeOnMove,
    });

    if (container.hasChildNodes())
      popup.setDOMContent(container);
    else
      popup.setText(label);


    return () => {
      popup.remove();
    };
  });

  $effect(() => {
    if (popup) {
      if (open)
        popup.addTo(map);
      else
        popup.remove();

    }
  });
</script>

<div bind:this={container}>
  {@render children?.()}
</div>

<style>
  :global(div .mapboxgl-popup-content) {
    padding: 12px;
  }
</style>
