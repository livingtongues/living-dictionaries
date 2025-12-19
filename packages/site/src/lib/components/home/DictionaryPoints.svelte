<script lang="ts">
  import { getContext } from 'svelte'
  import type { DictionaryView } from '@living-dictionaries/types'
  import GeoJSONSource from '$lib/components/maps/mapbox/sources/GeoJSONSource.svelte'
  import Layer from '$lib/components/maps/mapbox/map/Layer.svelte'
  import { dictionaryGeoJsonCollection } from '$lib/components/maps/utils/dictionaryGeoJsonCollection'
  import { type MapKeyContext, mapKey } from '$lib/components/maps/mapbox/context'

  interface Props {
    dictionaries?: DictionaryView[];
    selectedDictionaryId?: string;
    type?: 'public' | 'private' | 'personal';
  }

  let { dictionaries = [], selectedDictionaryId = $bindable(undefined), type = 'public' }: Props = $props();

  const { getMap } = getContext<MapKeyContext>(mapKey)
  const map = getMap()

  const clustersId = `${type}_clusters`

// map.loadImage("/icons/favicon-32x32.png", function(error, image) {
  //   if (error) throw error;
  //   map.addImage("logo", image);
  // });
</script>

<GeoJSONSource
  data={dictionaryGeoJsonCollection(dictionaries)}
  options={{ cluster: true, clusterMaxZoom: 6, clusterRadius: 28 }}
  >
  {#snippet children({ source })}
    <Layer
      id={clustersId}
      options={{
        type: 'circle',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            type === 'private' ? 'black' : '#6f8d9b',
            10,
            type === 'private' ? 'black' : '#546e7a',
          ],
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            type === 'private' ? 8 : 15,
            10,
            type === 'private' ? 12 : 20,
          ],
        },
      }}
      onclick={(e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: [clustersId],
        })
        const clusterId = features[0].properties.cluster_id
        source.getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) return
          map.easeTo({
            // @ts-expect-error
            center: features[0].geometry.coordinates,
            zoom,
          })
        })
      }}
      onmouseenter={() => (map.getCanvas().style.cursor = 'pointer')}
      onmouseleave={() => (map.getCanvas().style.cursor = '')} />
    <Layer
      options={{
        type: 'symbol',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 14,
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': '#fff',
        },
      }} />
    <Layer
      options={{
        type: 'symbol',
        filter: ['!', ['has', 'point_count']],
        layout: {
          'text-field': ['get', 'name'],
          'text-size': type === 'private' ? 15 : type === 'personal' ? 25 : 19,
          'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
          'text-radial-offset': 0.6,
          'text-justify': 'auto',
          'icon-image': type === 'private' ? 'rocket-15' : 'library-15', // https://api.mapbox.com/styles/v1/mapbox/light-v10/sprite.json?access_token=
          // "icon-image": ["get", "icon"],
          // "icon-image": "{icon}-15", //library-15
          // "icon-image": "logo",
          'icon-size': 1,
          // "text-allow-overlap": true,
          'icon-allow-overlap': true,
        },
        paint: {
          'text-color': type === 'private' ? 'black' : 'hsla(198, 14%, 20%, 1)',
          'text-halo-color': '#fff',
          'text-halo-width': type === 'private' ? 0 : 2,
        },
      }}
      onclick={(e) => {
        // const point = e.features[0].geometry as Point;
        // @ts-expect-error
        const coordinates = e.features[0].geometry.coordinates.slice()

        // Ensure that if the map is zoomed out such that multiple
        // copies of the feature are visible, the popup appears
        // over the copy being pointed to.
        while (Math.abs(e.lngLat.lng - coordinates[0]) > 180)
          coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360

        map.setCenter(coordinates)

        const { id } = e.features[0].properties
        selectedDictionaryId = id
      }}
      onmouseenter={() => (map.getCanvas().style.cursor = 'pointer')}
      onmouseleave={() => (map.getCanvas().style.cursor = '')} />
  {/snippet}
</GeoJSONSource>
