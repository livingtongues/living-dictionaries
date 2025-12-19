<script lang="ts">
  import { run } from 'svelte/legacy';

  import { getContext, onDestroy, setContext } from 'svelte'
  import type { GeoJSONSource, GeoJSONSourceOptions, GeoJSONSourceRaw } from 'mapbox-gl'
  import { type MapKeyContext, type SourceKeyContext, mapKey, sourceKey } from '../context'
  import { randomId } from '../../utils/randomId'

  
  interface Props {
    // Cf https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#geojson
    id?: any;
    data: GeoJSONSourceOptions['data']; // URL or inline data
    options?: Partial<GeoJSONSourceRaw>;
    children?: import('svelte').Snippet<[any]>;
  }

  let {
    id = randomId(),
    data,
    options = {},
    children
  }: Props = $props();

  const { getMap } = getContext<MapKeyContext>(mapKey)
  const map = getMap()

  // Remember ID of all <Layer> children, in order to remove them in onDestroy, before removing the source.
  const layerIds = []

  setContext<SourceKeyContext>(sourceKey, {
    getSourceId: () => id,
    addChildLayer: (id: string) => {
      layerIds.push(id)
    },
  })

  let source: GeoJSONSource = $state()
  function addSource() {
    map.addSource(id, {
      ...options,
      type: 'geojson',
      data,
    })
    source = map.getSource(id) as GeoJSONSource
  }

  function handleStyledata() {
    if (!map.getSource(id))
      addSource()
  }

  run(() => {
    source = map.getSource(id) as GeoJSONSource
    if (source) {
      // @ts-expect-error
      source.setData(data)
    } else {
      // Add the source before "styledata" event occurs to make it available to child <Layer>.
      addSource()

      // Listen to "styledata" event to re-create the source if the style changes.
      map.on('styledata', handleStyledata)
    }
  });

  onDestroy(() => {
    map.off('styledata', handleStyledata)

    // Remove all <Layer> children of <GeoJSONSource>.
    for (const layerId of layerIds) {
      if (map.getLayer(layerId))
        map.removeLayer(layerId)
    }

    if (map.getSource(id))
      map.removeSource(id)
  })
</script>

{@render children?.({ source, })}
