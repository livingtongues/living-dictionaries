<script lang="ts">
  import { getContext, onDestroy } from 'svelte'
  import { map_key } from '../context'
  import type { MapKeyContext } from '../context'

  const { get_map, get_mapbox } = getContext<MapKeyContext>(map_key)
  const map = get_map()
  const mapbox = get_mapbox()

  interface Props {
    position?: 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left'
    maxWidth?: number
    unit?: string
    options?: any
  }

  const {
    position = 'bottom-right',
    maxWidth = 80,
    unit = 'metric',
    options = {},
  }: Props = $props()

  const scale = new mapbox.ScaleControl({
    ...options,
    maxWidth,
    unit,
  })
  map.addControl(scale, position)

  onDestroy(() => {
    map?.removeControl(scale)
  })
</script>
