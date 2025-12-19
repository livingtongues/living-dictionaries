<script lang="ts">
  import { run } from 'svelte/legacy';

  // from https://gitlab.com/jailbreak/svelte-mapbox-gl
  import { getContext, onDestroy } from 'svelte';
  import { mapKey, sourceKey, type MapKeyContext, type SourceKeyContext } from '../context';
  import { randomId } from '../../utils/randomId';
  import type {
    AnyLayer,
    MapLayerMouseEvent,
    MapLayerTouchEvent,
    MapLayerEventType,
  } from 'mapbox-gl';

  const { getMap } = getContext<MapKeyContext>(mapKey);
  const map = getMap();
  const { getSourceId, addChildLayer } = getContext<SourceKeyContext>(sourceKey);
  const sourceId = getSourceId();

  

  interface Props {
    id?: any;
    // see https://docs.mapbox.com/mapbox-gl-js/style-spec/layers
    options?: Partial<AnyLayer>;
    minzoom?: number; // 0-24
    maxzoom?: number; // 0-24
    beforeLayerId?: string; // see https://docs.mapbox.com/mapbox-gl-js/example/geojson-layer-in-stack/ to create a FindFirstSymbolLayer component.
    onclick?: (e: MapLayerMouseEvent) => void;
    ondblclick?: (e: MapLayerMouseEvent) => void;
    onmousedown?: (e: MapLayerMouseEvent) => void;
    onmouseup?: (e: MapLayerMouseEvent) => void;
    onmousemove?: (e: MapLayerMouseEvent) => void;
    onmouseenter?: (e: MapLayerMouseEvent) => void;
    onmouseleave?: (e: MapLayerMouseEvent) => void;
    onmouseover?: (e: MapLayerMouseEvent) => void;
    onmouseout?: (e: MapLayerMouseEvent) => void;
    oncontextmenu?: (e: MapLayerMouseEvent) => void;
    ontouchstart?: (e: MapLayerTouchEvent) => void;
    ontouchend?: (e: MapLayerTouchEvent) => void;
    ontouchcancel?: (e: MapLayerTouchEvent) => void;
  }

  let {
    id = randomId(),
    options = {
    type: 'fill',
    paint: {
      'fill-color': '#f08',
      'fill-opacity': 0.4,
    },
  },
    minzoom = undefined,
    maxzoom = undefined,
    beforeLayerId = undefined,
    onclick,
    ondblclick,
    onmousedown,
    onmouseup,
    onmousemove,
    onmouseenter,
    onmouseleave,
    onmouseover,
    onmouseout,
    oncontextmenu,
    ontouchstart,
    ontouchend,
    ontouchcancel
  }: Props = $props();

  function addLayer() {
    map.addLayer(
      // @ts-ignore - CustomLayerInterface throws off types here
      { ...(options as AnyLayer), id, source: sourceId },
      beforeLayerId
    );
  }

  // Cf https://docs.mapbox.com/mapbox-gl-js/api/#map#on
  const eventCallbacks = {
    click: onclick,
    dblclick: ondblclick,
    mousedown: onmousedown,
    mouseup: onmouseup,
    mousemove: onmousemove,
    mouseenter: onmouseenter,
    mouseleave: onmouseleave,
    mouseover: onmouseover,
    mouseout: onmouseout,
    contextmenu: oncontextmenu,
    touchstart: ontouchstart,
    touchend: ontouchend,
    touchcancel: ontouchcancel,
  };

  const handlers: [keyof MapLayerEventType, (e: any) => any][] = Object.entries(eventCallbacks)
    .filter(([_, callback]) => callback)
    .map(([eventName, callback]) => [
      eventName as keyof MapLayerEventType,
      (e) => callback?.(e),
    ]);

  // If the style changes, check that source is defined, because many "styledata" events are triggered,
  // and source is not defined when the first one occurs, then re-create the layer
  const handleStyledata = () => !map.getLayer(id) && map.getSource(sourceId) && addLayer();

  run(() => {
    const layer = map.getLayer(id);
    if (layer) {
      map.setLayerZoomRange(id, minzoom || 0, maxzoom || 24);

      if (options?.type !== 'custom') {
        if (options.filter)
          map.setFilter(id, options.filter);

        if (options.layout) {
          for (const [name, value] of Object.entries(options.layout))
            map.setLayoutProperty(id, name, value);

        }
        if (options.paint) {
          for (const [name, value] of Object.entries(options.paint))
            map.setPaintProperty(id, name, value);

        }
      }
    } else {
      addLayer();
      for (const [name, handler] of handlers)
        map.on(name, id, handler);

      map.on('styledata', handleStyledata);
      addChildLayer(id);
    }
  });

  onDestroy(() => {
    for (const [name, handler] of handlers)
      map.off(name, id, handler);

    map.off('styledata', handleStyledata);
    // If <Layer> is child of <Source>, the layer will have been removed by the onDestroy of <Source>.
    // The following statement ensures layer is removed in other cases.
    if (map.getLayer(id))
      map.removeLayer(id);

  });
</script>
