<script lang="ts">
  import { getContext, onDestroy } from 'svelte'
  import { map_key } from '../context'
  import type { MapKeyContext } from '../context'

  const { get_map, get_mapbox } = getContext<MapKeyContext>(map_key)
  const map = get_map()
  const mapbox = get_mapbox()

  interface Props {
    position?: 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left'
    showCompass?: boolean
    showZoom?: boolean
    visualizePitch?: boolean
  }

  const {
    position = 'top-right',
    showCompass = true,
    showZoom = true,
    visualizePitch = true,
  }: Props = $props()

  const nav = new mapbox.NavigationControl({
    showCompass,
    showZoom,
    visualizePitch,
  })
  map.addControl(nav, position)

  onDestroy(() => {
    map?.removeControl(nav)
  })
</script>
