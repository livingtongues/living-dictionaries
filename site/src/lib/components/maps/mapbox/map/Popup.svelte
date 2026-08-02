<script lang="ts">
  // from https://gitlab.com/jailbreak/svelte-mapbox-gl
  import { getContext, onMount } from 'svelte'
  import type { Marker, Popup, PopupOptions } from 'mapbox-gl'
  import { map_key, marker_key } from '../context'

  const { get_mapbox } = getContext<{ get_mapbox: () => typeof import('mapbox-gl') }>(map_key)
  const mapbox = get_mapbox()

  const { get_marker } = getContext<{ get_marker: () => Marker }>(marker_key)
  const marker = get_marker()

  interface Props {
    closeButton?: boolean
    closeOnClick?: boolean
    closeOnMove?: boolean
    options?: PopupOptions
    offset?: number
    label?: string
    open?: boolean
    children?: import('svelte').Snippet
  }

  const {
    closeButton = false,
    closeOnClick = true,
    closeOnMove = true,
    options = {},
    offset = 15,
    label = 'Marker',
    open = false,
    children,
  }: Props = $props()
  // make my own close button

  let popup: Popup = $state()
  let container: HTMLDivElement = $state()

  onMount(() => {
    popup = new mapbox.Popup({
      ...options,
      closeButton,
      closeOnClick,
      closeOnMove,
      offset,
    })

    if (container.hasChildNodes())
      popup.setDOMContent(container)
    else
      popup.setText(label)

    marker.setPopup(popup)

    return () => {
      marker.setPopup(null)
    }
  })

  $effect(() => {
    if (popup) {
      if (open !== popup.isOpen())
        marker.togglePopup()
    }
  })
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
