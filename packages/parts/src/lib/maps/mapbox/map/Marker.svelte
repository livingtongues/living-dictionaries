<script lang="ts">
  import { onMount, getContext, createEventDispatcher } from 'svelte';
  import { contextKey } from '../contextKey';
  import type { LngLat, Map, Marker } from 'mapbox-gl';

  const { getMap, getMapbox } = getContext(contextKey);
  const map: Map = getMap();
  const mapbox: typeof import('mapbox-gl') = getMapbox();

  function randomColour() {
    return Math.round(Math.random() * 255);
  }

  export let lat: number;
  export let lng: number;
  export let label = 'Marker';
  export let popupClassName = 'beyonk-mapbox-popup';
  export let markerOffset: [number, number] = [0, 0];
  export let popupOffset = 10;
  export let color = randomColour();
  export let popup = true;
  export let popupOptions = {};
  export let markerOptions = {};
  export let draggable = true;

  let marker: Marker;
  let element: HTMLDivElement; // if main slot used
  let elementPopup: HTMLDivElement; // if popup slot used

  $: marker?.setLngLat({ lng, lat });

  const dispatch = createEventDispatcher<{ dragend: LngLat }>();

  onMount(() => {
    const customMarker = element.hasChildNodes();
    const elementOrColor: { element } | { color } = customMarker ? { element } : { color };
    marker = new mapbox.Marker({
      ...elementOrColor,
      ...markerOptions,
      offset: markerOffset,
      draggable,
    });

    marker.getElement().addEventListener('click', (e) => {
      console.log('clicked!');
      // e.stopPropagation();
    });

    if (popup) {
      const popupEl = new mapbox.Popup({
        ...popupOptions,
        offset: popupOffset,
        className: popupClassName,
      });
      if (elementPopup.hasChildNodes()) {
        popupEl.setDOMContent(elementPopup);
      } else {
        popupEl.setText(label);
      }

      marker.setPopup(popupEl);
    }

    marker.setLngLat({ lng, lat }).addTo(map);
    marker.on('dragend', () => dispatch('dragend', marker.getLngLat()));

    return () => {
      marker.off('dragend', () => dispatch('dragend', marker.getLngLat()));
      marker.remove();
    };
  });

  export function getMarker() {
    return marker;
  }
</script>

<div bind:this={element}>
  <slot />
</div>

<div class="popup" bind:this={elementPopup}>
  <slot name="popup" />
</div>
