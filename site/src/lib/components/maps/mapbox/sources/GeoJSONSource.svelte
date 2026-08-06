<script lang="ts">
  import { getContext, onDestroy, setContext } from 'svelte'
  import type { GeoJSONSource, GeoJSONSourceOptions, GeoJSONSourceRaw } from 'mapbox-gl'
  import { map_key, source_key } from '../context'
  import type { MapKeyContext, SourceKeyContext } from '../context'
  import { random_id } from '../../utils/random-id'

  interface Props {
    // Cf https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#geojson
    id?: any
    data: GeoJSONSourceOptions['data'] // URL or inline data
    options?: Partial<GeoJSONSourceRaw>
    children?: import('svelte').Snippet<[any]>
  }

  const {
    id = random_id(),
    data,
    options = {},
    children,
  }: Props = $props()

  const { get_map } = getContext<MapKeyContext>(map_key)
  const map = get_map()

  // Remember ID of all <Layer> children, in order to remove them in onDestroy, before removing the source.
  const layer_ids = []

  setContext<SourceKeyContext>(source_key, {
    get_source_id: () => id,
    add_child_layer: (id: string) => {
      layer_ids.push(id)
    },
  })

  let source: GeoJSONSource = $state()
  function add_source() {
    map.addSource(id, {
      ...options,
      type: 'geojson',
      data,
    })
    source = map.getSource(id) as GeoJSONSource
  }

  function handle_styledata() {
    if (!map.getSource(id))
      add_source()
  }

  $effect(() => {
    source = map.getSource(id) as GeoJSONSource
    if (source) {
      // @ts-expect-error
      source.setData(data)
    } else {
      // Add the source before "styledata" event occurs to make it available to child <Layer>.
      add_source()

      // Listen to "styledata" event to re-create the source if the style changes.
      map.on('styledata', handle_styledata)
    }
  })

  onDestroy(() => {
    map.off('styledata', handle_styledata)

    // Remove all <Layer> children of <GeoJSONSource>.
    for (const layer_id of layer_ids) {
      if (map.getLayer(layer_id))
        map.removeLayer(layer_id)
    }

    if (map.getSource(id))
      map.removeSource(id)
  })
</script>

{@render children?.({ source })}
