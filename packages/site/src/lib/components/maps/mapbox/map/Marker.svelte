<script lang="ts" module>
  const markers = new Set<Marker>()

  function closeOtherPopups(currentMarker: Marker) {
    markers.forEach((marker) => {
      if (marker === currentMarker) return
      const popup = marker.getPopup()
      if (popup?.isOpen())
        marker.togglePopup()
    })
  }
</script>

<script lang="ts">
  import { run } from 'svelte/legacy';

  import { createEventDispatcher, getContext, onMount, setContext } from 'svelte'
  import type { LngLat, Marker, MarkerOptions } from 'mapbox-gl'
  import { type MapKeyContext, type MarkerKeyContext, mapKey, markerKey } from '../context'

  const { getMap, getMapbox } = getContext<MapKeyContext>(mapKey)
  const map = getMap()
  const mapbox = getMapbox()

  interface Props {
    lat: number;
    lng: number;
    color?: 'blue' | 'black';
    options?: MarkerOptions;
    draggable?: boolean;
    pin?: import('svelte').Snippet<[any]>;
    children?: import('svelte').Snippet<[any]>;
  }

  let {
    lat = $bindable(),
    lng = $bindable(),
    color = 'black',
    options = {},
    draggable = false,
    pin,
    children
  }: Props = $props();

  let marker: Marker = $state()
  let element: HTMLDivElement = $state()
  let markerEl: HTMLElement

  setContext<MarkerKeyContext>(markerKey, {
    getMarker: () => marker,
  })

  run(() => {
    marker?.setLngLat({ lng, lat })
  });

  const dispatch = createEventDispatcher<{ dragend: LngLat }>()

  function handleClick(e) {
    e.stopPropagation()
    closeOtherPopups(marker)
    marker.togglePopup()
  }

  function handleDragEnd() {
    markerEl.removeEventListener('click', handleClick)
    const coordinates = marker.getLngLat()
    dispatch('dragend', coordinates);
    ({ lat, lng } = coordinates)
  }

  onMount(() => {
    const customMarker = element.hasChildNodes() // if pin slot used
    const elementOrColor: { element } | { color } = customMarker ? { element } : { color }

    marker = new mapbox.Marker({
      ...elementOrColor,
      ...options,
      draggable,
    })
    markers.add(marker)

    markerEl = marker.getElement()
    markerEl.addEventListener('click', handleClick) // addEventListener to element instead of using marker on 'click' to be able to call stopPropagation first, otherwise map click will also fire
    marker.on('dragend', handleDragEnd)
    marker.setLngLat({ lng, lat }).addTo(map)

    return () => {
      markerEl.removeEventListener('click', handleClick)
      marker.off('dragend', handleDragEnd)
      marker.remove()
    }
  })
</script>

<div bind:this={element}>
  {@render pin?.({ marker, lat, lng, })}
</div>

{#if marker}
  {@render children?.({ marker, lat, lng, })}
{/if}
