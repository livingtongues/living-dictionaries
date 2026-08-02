<script lang="ts">
  import { getContext, onMount } from 'svelte'
  import { map_key } from '../context'
  import type { MapKeyContext } from '../context'
  import { bind_events } from '../event-bindings'

  const { get_map, get_mapbox } = getContext<MapKeyContext>(map_key)
  const map = get_map()
  const mapbox = get_mapbox()

  interface Props {
    position?: 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left'
    options?: any
    on_geolocate?: (e: any) => void
    on_outofmaxbounds?: (e: any) => void
    on_trackuserlocationstart?: (e: any) => void
    on_trackuserlocationend?: (e: any) => void
    on_error?: (e: any) => void
  }

  const { position = 'top-right', options = {}, on_geolocate, on_outofmaxbounds, on_trackuserlocationstart, on_trackuserlocationend, on_error }: Props = $props()

  const geolocate = new mapbox.GeolocateControl(options)
  map.addControl(geolocate, position)

  const handlers: Record<string, any> = {
    geolocate: e => on_geolocate?.(e),
    outofmaxbounds: e => on_outofmaxbounds?.(e),
    trackuserlocationstart: e => on_trackuserlocationstart?.(e),
    trackuserlocationend: e => on_trackuserlocationend?.(e),
    error: e => on_error?.(e),
  }

  onMount(() => {
    const unbind = bind_events({ emitter: geolocate, handlers })
    return () => {
      unbind()
      map?.removeControl(geolocate)
    }
  })

  export function trigger() {
    geolocate.trigger()
  }
</script>
