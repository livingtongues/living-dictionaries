<script lang="ts" context="module">
  const markers = new Set<Marker>();

  function closeOtherPopups(currentMarker: Marker) {
    markers.forEach((marker) => {
      if (marker === currentMarker) return;
      const popup = marker.getPopup();
      if (popup?.isOpen()) {
        marker.togglePopup();
      }
    });
  }
</script>

<script lang="ts">
  import { onMount, getContext, createEventDispatcher, setContext } from 'svelte';
  import { mapKey, markerKey } from '../context';
  import type { LngLat, Map, Marker, MarkerOptions } from 'mapbox-gl';

  const { getMap, getMapbox } = getContext(mapKey);
  const map: Map = getMap();
  const mapbox: typeof import('mapbox-gl') = getMapbox();

  setContext(markerKey, {
    getMarker: () => marker,
  });

  export let lat: number;
  export let lng: number;
  export let color = 'black';
  export let options: MarkerOptions = {};
  export let draggable = false;

  let marker: Marker;
  let element: HTMLDivElement;
  let markerEl: HTMLElement;

  $: marker?.setLngLat({ lng, lat });

  const dispatch = createEventDispatcher<{ dragend: LngLat }>();

  function handleClick(e) {
    e.stopPropagation();
    closeOtherPopups(marker);
    marker.togglePopup();
  }

  function handleDragEnd() {
    markerEl.removeEventListener('click', handleClick);
    const coordinates = marker.getLngLat();
    dispatch('dragend', coordinates);
    ({ lat, lng } = coordinates);
  }

  onMount(() => {
    const customMarker = element.hasChildNodes(); // if pin slot used
    const elementOrColor: { element } | { color } = customMarker ? { element } : { color };

    marker = new mapbox.Marker({
      ...elementOrColor,
      ...options,
      draggable,
    });
    markers.add(marker);

    markerEl = marker.getElement();
    markerEl.addEventListener('click', handleClick); // addEventListener to element instead of using marker on 'click' to be able to call stopPropagation first, otherwise map click will also fire
    marker.on('dragend', handleDragEnd);
    marker.setLngLat({ lng, lat }).addTo(map);

    return () => {
      markerEl.removeEventListener('click', handleClick);
      marker.off('dragend', handleDragEnd);
      marker.remove();
    };
  });
</script>

<div bind:this={element}>
  <slot name="pin" {marker} {lat} {lng} />
</div>

{#if marker}
  <slot {marker} {lat} {lng} />
{/if}
