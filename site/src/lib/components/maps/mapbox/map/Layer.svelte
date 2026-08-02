<script lang="ts">
  // from https://gitlab.com/jailbreak/svelte-mapbox-gl
  import { getContext, onDestroy } from 'svelte'
  import type {
    AnyLayer,
    MapLayerEventType,
    MapLayerMouseEvent,
    MapLayerTouchEvent,
  } from 'mapbox-gl'
  import { map_key, source_key } from '../context'
  import type { MapKeyContext, SourceKeyContext } from '../context'
  import { random_id } from '../../utils/random-id'

  const { get_map } = getContext<MapKeyContext>(map_key)
  const map = get_map()
  const { get_source_id, add_child_layer } = getContext<SourceKeyContext>(source_key)
  const source_id = get_source_id()

  interface Props {
    id?: any
    // see https://docs.mapbox.com/mapbox-gl-js/style-spec/layers
    options?: Partial<AnyLayer>
    minzoom?: number // 0-24
    maxzoom?: number // 0-24
    before_layer_id?: string // see https://docs.mapbox.com/mapbox-gl-js/example/geojson-layer-in-stack/ to create a FindFirstSymbolLayer component.
    on_click?: (e: MapLayerMouseEvent) => void
    on_dblclick?: (e: MapLayerMouseEvent) => void
    on_mousedown?: (e: MapLayerMouseEvent) => void
    on_mouseup?: (e: MapLayerMouseEvent) => void
    on_mousemove?: (e: MapLayerMouseEvent) => void
    on_mouseenter?: (e: MapLayerMouseEvent) => void
    on_mouseleave?: (e: MapLayerMouseEvent) => void
    on_mouseover?: (e: MapLayerMouseEvent) => void
    on_mouseout?: (e: MapLayerMouseEvent) => void
    on_contextmenu?: (e: MapLayerMouseEvent) => void
    on_touchstart?: (e: MapLayerTouchEvent) => void
    on_touchend?: (e: MapLayerTouchEvent) => void
    on_touchcancel?: (e: MapLayerTouchEvent) => void
  }

  const {
    id = random_id(),
    options = {
      type: 'fill',
      paint: {
        'fill-color': '#f08',
        'fill-opacity': 0.4,
      },
    },
    minzoom = undefined,
    maxzoom = undefined,
    before_layer_id = undefined,
    ...callbacks
  }: Props = $props()

  function add_layer() {
    map.addLayer(
      // @ts-ignore - CustomLayerInterface throws off types here
      { ...(options as AnyLayer), id, source: source_id },
      before_layer_id,
    )
  }

  // Cf https://docs.mapbox.com/mapbox-gl-js/api/#map#on
  const event_names = [
    'click',
    'dblclick',
    'mousedown',
    'mouseup',
    'mousemove',
    'mouseenter',
    'mouseleave',
    'mouseover',
    'mouseout',
    'contextmenu',
    'touchstart',
    'touchend',
    'touchcancel',
  ]

  const handlers: [keyof MapLayerEventType, (e: any) => any][] = event_names.map((event_name) => {
    return [
      event_name as keyof MapLayerEventType,
      e => callbacks[`on_${event_name}`]?.(e),
    ]
  })

  // If the style changes, check that source is defined, because many "styledata" events are triggered,
  // and source is not defined when the first one occurs, then re-create the layer
  const handle_styledata = () => !map.getLayer(id) && map.getSource(source_id) && add_layer()

  $effect(() => {
    const layer = map.getLayer(id)
    if (layer) {
      map.setLayerZoomRange(id, minzoom || 0, maxzoom || 24)

      if (options?.type !== 'custom') {
        if (options.filter)
          map.setFilter(id, options.filter)

        if (options.layout) {
          for (const [name, value] of Object.entries(options.layout))
            map.setLayoutProperty(id, name, value)
        }
        if (options.paint) {
          for (const [name, value] of Object.entries(options.paint))
            map.setPaintProperty(id, name, value)
        }
      }
    } else {
      add_layer()
      for (const [name, handler] of handlers)
        map.on(name, id, handler)

      map.on('styledata', handle_styledata)
      add_child_layer(id)
    }
  })

  onDestroy(() => {
    for (const [name, handler] of handlers)
      map.off(name, id, handler)

    map.off('styledata', handle_styledata)
    // If <Layer> is child of <Source>, the layer will have been removed by the onDestroy of <Source>.
    // The following statement ensures layer is removed in other cases.
    if (map.getLayer(id))
      map.removeLayer(id)
  })
</script>
