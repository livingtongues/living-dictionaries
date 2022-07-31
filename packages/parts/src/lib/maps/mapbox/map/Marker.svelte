<script lang="ts">
  import { onMount, getContext, createEventDispatcher } from 'svelte';
  import { contextKey } from '../contextKey';
  import type { LngLat, Map, Marker, MarkerOptions } from 'mapbox-gl';

  const { getMap, getMapbox } = getContext(contextKey);
  const map: Map = getMap();
  const mapbox: typeof import('mapbox-gl') = getMapbox();

  function randomColour() {
    return Math.round(Math.random() * 255);
  }

  export let lat: number;
  export let lng: number;
  export let markerOffset: [number, number] = [0, 0];
  export let color = randomColour();
  export let options: MarkerOptions = {};
  export let draggable = true;

  let marker: Marker;
  let element: HTMLDivElement;
  let markerEl;

  $: marker?.setLngLat({ lng, lat });

  const dispatch = createEventDispatcher<{ dragend: LngLat }>();

  function handleClick(e) {
    e.stopPropagation();
    marker.togglePopup();
    // open = !open;
    // console.log({ open });
  }

  function handleDragEnd() {
    // markerEl.removeEventListener('click', handleClick);
    dispatch('dragend', marker.getLngLat());
  }

  onMount(() => {
    const customMarker = element.hasChildNodes(); // if pin slot used
    const elementOrColor: { element } | { color } = customMarker ? { element } : { color };
    marker = new mapbox.Marker({
      ...elementOrColor,
      ...options,
      offset: markerOffset,
      draggable,
    });

    markerEl = marker.getElement().addEventListener('click', handleClick);

    marker.setLngLat({ lng, lat }).addTo(map);
    marker.on('dragend', handleDragEnd);

    return () => {
      marker.off('dragend', handleDragEnd);
      marker.remove();
    };
  });
</script>

<div bind:this={element}>
  <slot name="pin" {marker} />
</div>

{#if marker}
  <slot {marker} />
{/if}
