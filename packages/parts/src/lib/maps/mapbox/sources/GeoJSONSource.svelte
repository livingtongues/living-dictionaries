<script lang="ts">
  import { getContext, setContext, onDestroy } from 'svelte';
  import { mapKey, sourceKey } from '../context';
  import type { Map, GeoJSONSourceRaw, GeoJSONSource } from 'mapbox-gl';

  // Cf https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#geojson
  export let id: string;
  export let data; // URL or inline data
  export let options: Partial<GeoJSONSourceRaw> = {};

  const { getMap } = getContext(mapKey);
  const map: Map = getMap();

  // Remember ID of all <Layer> children, in order to remove them in onDestroy, before removing the source.
  const layerIds = [];

  setContext(sourceKey, {
    getSourceId: () => id,
    addChildLayer: (id: string) => {
      layerIds.push(id);
    },
  });

  function addSource() {
    map.addSource(id, {
      ...options,
      type: 'geojson',
      data,
    });
  }

  function handleStyledata() {
    if (!map.getSource(id)) {
      addSource();
    }
  }

  $: {
    const source = map.getSource(id) as GeoJSONSource;
    if (source) {
      source.setData(data);
    } else {
      // Add the source before "styledata" event occurs to make it available to child <Layer>.
      addSource();

      // Listen to "styledata" event to re-create the source if the style changes.
      map.on('styledata', handleStyledata);
    }
  }

  onDestroy(() => {
    map.off('styledata', handleStyledata);

    // Remove all <Layer> children of <GeoJSONSource>.
    for (const layerId of layerIds) {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
    }

    if (map.getSource(id)) {
      map.removeSource(id);
    }
  });
</script>

<slot />
