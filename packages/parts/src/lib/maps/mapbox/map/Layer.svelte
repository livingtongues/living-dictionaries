<script lang="ts">
  // from https://gitlab.com/jailbreak/svelte-mapbox-gl
  import { createEventDispatcher, getContext, onDestroy } from 'svelte';
  import { mapKey, sourceKey } from '../context';
  import type {
    Map,
    AnyLayer,
    MapLayerMouseEvent,
    MapLayerTouchEvent,
    MapLayerEventType,
  } from 'mapbox-gl';

  const { getMap } = getContext(mapKey);
  const map: Map = getMap();
  const { getSourceId, addChildLayer } = getContext(sourceKey);
  const sourceId = getSourceId() as string;

  export let id: string;
  // see https://docs.mapbox.com/mapbox-gl-js/style-spec/layers
  export let options: Partial<AnyLayer> = {
    type: 'fill',
    paint: {
      'fill-color': '#f08',
      'fill-opacity': 0.4,
    },
  };
  $: console.log({options})
  export let minzoom: number = undefined; // 0-24
  export let maxzoom: number = undefined; // 0-24
  export let beforeLayerId: string = undefined; // see https://docs.mapbox.com/mapbox-gl-js/example/geojson-layer-in-stack/ to create a FindFirstSymbolLayer component.

  function addLayer() {
    map.addLayer(
      // @ts-ignore - CustomLayerInterface throws off types here
      { ...(options as AnyLayer), id, source: sourceId },
      beforeLayerId
    );
  }

  // Cf https://docs.mapbox.com/mapbox-gl-js/api/#map#on
  const dispatch = createEventDispatcher<{
    click: MapLayerMouseEvent;
    dblclick: MapLayerMouseEvent;
    mousedown: MapLayerMouseEvent;
    mouseup: MapLayerMouseEvent;
    mousemove: MapLayerMouseEvent;
    mouseenter: MapLayerMouseEvent;
    mouseleave: MapLayerMouseEvent;
    mouseover: MapLayerMouseEvent;
    mouseout: MapLayerMouseEvent;
    contextmenu: MapLayerMouseEvent;
    touchstart: MapLayerTouchEvent;
    touchend: MapLayerTouchEvent;
    touchcancel: MapLayerTouchEvent;
  }>();
  const eventNames = [
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
  ];

  const handlers: [keyof MapLayerEventType, (e: any) => any][] = eventNames.map((eventName) => {
    return [
      eventName as keyof MapLayerEventType,
      (e) => dispatch(eventName as keyof MapLayerEventType, e),
    ];
  });

  // If the style changes, check that source is defined, because many "styledata" events are triggered,
  // and source is not defined when the first one occurs, then re-create the layer
  const handleStyledata = () => !map.getLayer(id) && map.getSource(sourceId) && addLayer();

  $: {
    const layer = map.getLayer(id);
    if (layer) {
      map.setLayerZoomRange(id, minzoom || 0, maxzoom || 24);

      if (options?.type !== 'custom') {
        if (options.filter) {
          map.setFilter(id, options.filter);
        }
        if (options.layout) {
          for (const [name, value] of Object.entries(options.layout)) {
            map.setLayoutProperty(id, name, value);
          }
        }
        if (options.paint) {
          for (const [name, value] of Object.entries(options.paint)) {
            map.setPaintProperty(id, name, value);
          }
        }
      }
    } else {
      addLayer();
      for (const [name, handler] of handlers) {
        map.on(name, id, handler);
      }
      map.on('styledata', handleStyledata);
      addChildLayer(id);
    }
  }

  onDestroy(() => {
    for (const [name, handler] of handlers) {
      map.off(name, id, handler);
    }
    map.off('styledata', handleStyledata);
    // If <Layer> is child of <Source>, the layer will have been removed by the onDestroy of <Source>.
    // The following statement ensures layer is removed in other cases.
    if (map.getLayer(id)) {
      map.removeLayer(id);
    }
  });
</script>
