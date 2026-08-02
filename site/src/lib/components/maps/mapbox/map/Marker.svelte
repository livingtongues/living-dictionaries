<script lang="ts" module>
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- module-level registry of mounted markers, not reactive state
  const markers = new Set<Marker>()

  function close_other_popups(current_marker: Marker) {
    markers.forEach((marker) => {
      if (marker === current_marker) return
      const popup = marker.getPopup()
      if (popup?.isOpen())
        marker.togglePopup()
    })
  }
</script>

<script lang="ts">
  import { getContext, onMount, setContext } from 'svelte'
  import type { LngLat, Marker, MarkerOptions } from 'mapbox-gl'
  import { map_key, marker_key } from '../context'
  import type { MapKeyContext, MarkerKeyContext } from '../context'

  const { get_map, get_mapbox } = getContext<MapKeyContext>(map_key)
  const map = get_map()
  const mapbox = get_mapbox()

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
  let marker_el: HTMLElement

  setContext<MarkerKeyContext>(marker_key, {
    get_marker: () => marker,
  })

  $effect(() => {
    marker?.setLngLat({ lng, lat })
  })

  function handle_click(e) {
    e.stopPropagation()
    close_other_popups(marker)
    marker.togglePopup()
  }

  function handle_drag_end() {
    marker_el.removeEventListener('click', handle_click)
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

    marker_el = marker.getElement()
    marker_el.addEventListener('click', handle_click) // addEventListener to element instead of using marker on 'click' to be able to call stopPropagation first, otherwise map click will also fire
    marker.on('dragend', handle_drag_end)
    marker.setLngLat({ lng, lat }).addTo(map)

    return () => {
      marker_el.removeEventListener('click', handle_click)
      marker.off('dragend', handle_drag_end)
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
