<script lang="ts">
  import { getContext, onDestroy, setContext } from 'svelte'
  import type { VectorSource, VectorSourceImpl } from 'mapbox-gl'
  import { map_key, source_key } from '../context.js'
  import type { MapKeyContext, SourceKeyContext } from '../context.js'

  interface Props {
    // Cf https://docs.mapbox.com/mapbox-gl-js/style-spec/sources/#vector
    id: string
    url: string
    options?: Partial<VectorSource>
    children?: import('svelte').Snippet
  }

  const {
    id,
    url,
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

  function add_source() {
    map.addSource(id, {
      ...options,
      type: 'vector',
      url,
    })
  }

  function handle_styledata() {
    if (!map.getSource(id))
      add_source()
  }

  $effect(() => {
    const source = map.getSource(id) as VectorSourceImpl
    if (source) {
      source.setUrl(url)
    } else {
      // Add the source before "styledata" event occurs to make it available to child <Layer>.
      add_source()

      // Listen to "styledata" event to re-create the source if the style changes.
      map.on('styledata', handle_styledata)
    }
  })

  onDestroy(() => {
    map.off('styledata', handle_styledata)

    // Remove all <Layer> children of <VectorSource>.
    for (const layer_id of layer_ids) {
      if (map.getLayer(layer_id))
        map.removeLayer(layer_id)
    }

    if (map.getSource(id))
      map.removeSource(id)
  })
</script>

{@render children?.()}
