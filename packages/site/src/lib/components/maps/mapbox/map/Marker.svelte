<script lang="ts" context="module">
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
  import { createEventDispatcher, getContext, onMount, setContext } from 'svelte'
  import type { LngLat, Marker, MarkerOptions } from 'mapbox-gl'
  import { type MapKeyContext, type MarkerKeyContext, mapKey, markerKey } from '../context'

  const { getMap, getMapbox } = getContext<MapKeyContext>(mapKey)
  const map = getMap()
  const mapbox = getMapbox()

  export let lat: number
  export let lng: number
  export let color: 'blue' | 'black' = 'black'
  export let options: MarkerOptions = {}
  export let draggable = false

  let marker: Marker
  let element: HTMLDivElement
  let markerEl: HTMLElement

  setContext<MarkerKeyContext>(markerKey, {
    getMarker: () => marker,
  })

  $: marker?.setLngLat({ lng, lat })

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
  <slot name="pin" {marker} {lat} {lng} />
</div>

{#if marker}
  <slot {marker} {lat} {lng} />
{/if}
