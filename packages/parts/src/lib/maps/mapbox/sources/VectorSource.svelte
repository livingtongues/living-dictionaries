<script lang="ts">
  import { getContext, setContext, onDestroy } from 'svelte';
  import { mapKey, sourceKey, type MapKeyContext, type SourceKeyContext } from '../context.js';
  import type { VectorSource, VectorSourceImpl } from 'mapbox-gl';

  // Cf https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#vector
  export let id: string;
  export let url: string;
  export let options: Partial<VectorSource> = {};

  const { getMap } = getContext<MapKeyContext>(mapKey);
  const map = getMap();

  // Remember ID of all <Layer> children, in order to remove them in onDestroy, before removing the source.
  const layerIds = [];

  setContext<SourceKeyContext>(sourceKey, {
    getSourceId: () => id,
    addChildLayer: (id: string) => {
      layerIds.push(id);
    },
  });

  function addSource() {
    map.addSource(id, {
      ...options,
      type: 'vector',
      url,
    });
  }

  function handleStyledata() {
    if (!map.getSource(id))
      addSource();

  }

  $: {
    const source = map.getSource(id) as VectorSourceImpl;
    if (source) {
      source.setUrl(url);
    } else {
      // Add the source before "styledata" event occurs to make it available to child <Layer>.
      addSource();

      // Listen to "styledata" event to re-create the source if the style changes.
      map.on('styledata', handleStyledata);
    }
  }

  onDestroy(() => {
    map.off('styledata', handleStyledata);

    // Remove all <Layer> children of <VectorSource>.
    for (const layerId of layerIds) {
      if (map.getLayer(layerId))
        map.removeLayer(layerId);

    }

    if (map.getSource(id))
      map.removeSource(id);

  });
</script>

<slot />
