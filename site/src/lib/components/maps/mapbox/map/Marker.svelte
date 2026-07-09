<script lang="ts" module>
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- module-level registry of mounted markers, not reactive state
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
  import { getContext, onMount, setContext } from 'svelte'
  import type { LngLat, Marker, MarkerOptions } from 'mapbox-gl'
  import { mapKey, markerKey } from '../context'
  import type { MapKeyContext, MarkerKeyContext } from '../context'

  const { getMap, getMapbox } = getContext<MapKeyContext>(mapKey)
  const map = getMap()
  const mapbox = getMapbox()

  interface Props {
    lat: number
    lng: number
    color?: 'blue' | 'black'
    options?: MarkerOptions
    draggable?: boolean
    on_dragend?: (coordinates: LngLat) => void
    pin?: import('svelte').Snippet<[any]>
    children?: import('svelte').Snippet<[any]>
  }

  let {
    lat = $bindable(),
    lng = $bindable(),
    color = 'black',
    options = {},
    draggable = false,
    on_dragend,
    pin,
    children,
  }: Props = $props()

  let marker: Marker = $state()
  let element: HTMLDivElement = $state()
  let markerEl: HTMLElement

  setContext<MarkerKeyContext>(markerKey, {
    getMarker: () => marker,
  })

  $effect(() => {
    marker?.setLngLat({ lng, lat })
  })

  function handleClick(e) {
    e.stopPropagation()
    closeOtherPopups(marker)
    marker.togglePopup()
  }

  function handleDragEnd() {
    markerEl.removeEventListener('click', handleClick)
    const coordinates = marker.getLngLat()
    on_dragend?.(coordinates);
    ({ lat, lng } = coordinates)
  }

  onMount(() => {
    // Prefer the pin snippet prop over hasChildNodes(): Svelte 5 can leave
    // comment/whitespace nodes in the bound div, which made Mapbox treat an
    // empty div as a custom marker (invisible) instead of the default pin.
    const custom_marker = !!pin
    const element_or_color: { element: HTMLDivElement } | { color: string } = custom_marker
      ? { element }
      : { color }

    marker = new mapbox.Marker({
      ...element_or_color,
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
      markers.delete(marker)
    }
  })
</script>

<div bind:this={element}>
  {@render pin?.({ marker, lat, lng })}
</div>

{#if marker}
  {@render children?.({ marker, lat, lng })}
{/if}
