<script lang="ts">
  import { getContext, setContext, onDestroy } from 'svelte';
  import { mapKey, sourceKey, type MapKeyContext, type SourceKeyContext } from '../context';
  import { randomId } from '../../utils/randomId';
  import type { GeoJSONSourceRaw, GeoJSONSource, GeoJSONSourceOptions } from 'mapbox-gl';

  // Cf https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#geojson
  export let id = randomId();
  export let data: GeoJSONSourceOptions['data']; // URL or inline data
  export let options: Partial<GeoJSONSourceRaw> = {};

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

  let source: GeoJSONSource;
  function addSource() {
    map.addSource(id, {
      ...options,
      type: 'geojson',
      data,
    });
    source = map.getSource(id) as GeoJSONSource;
  }

  function handleStyledata() {
    if (!map.getSource(id))
      addSource();

  }

  $: {
    source = map.getSource(id) as GeoJSONSource;
    if (source) {
      // @ts-ignore
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
      if (map.getLayer(layerId))
        map.removeLayer(layerId);

    }

    if (map.getSource(id))
      map.removeSource(id);

  });
</script>

<slot {source} />
