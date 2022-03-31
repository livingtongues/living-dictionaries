<script lang="ts">
  import type { IDictionary } from '$lib/interfaces';
  export let dictionaries: IDictionary[] = [],
    selectedDictionaryId: string = undefined,
    source: 'public' | 'private' | 'personal' = 'public';
  import { getContext } from 'svelte';
  import { contextKey } from '$lib/components/home/key';

  const { getMap } = getContext(contextKey);
  const map = getMap();

  import { DictionaryGeoJsonCollection } from './map.class';
  let dictionaryLocations = new DictionaryGeoJsonCollection(dictionaries);

  // map.loadImage("/icons/favicon-32x32.png", function(error, image) {
  //   if (error) throw error;
  //   map.addImage("logo", image);
  // });

  // Add a new source from our GeoJSON data and set the
  // 'cluster' option to true. GL-JS will add the point_count property to your source data.

  let sourceId = `${source}_dictionaries`;

  function addLayers() {
    map.addSource(sourceId, {
      type: 'geojson',
      data: dictionaryLocations,
      cluster: true,
      clusterMaxZoom: 6, // Max zoom to cluster points on
      clusterRadius: 28, // Radius of each cluster when clustering points (defaults to 50)
    });

    map.addLayer({
      id: `${source}_clusters`,
      type: 'circle',
      source: sourceId,
      filter: ['has', 'point_count'],
      paint: {
        // https://docs.mapbox.com/mapbox-gl-js/style-spec/#expressions-step
        // https://docs.mapbox.com/mapbox-gl-js/style-spec/layers/#circle
        'circle-color': [
          'step',
          ['get', 'point_count'],
          source === 'private' ? 'black' : '#6f8d9b',
          10,
          source === 'private' ? 'black' : '#546e7a',
        ],
        'circle-radius': [
          'step',
          ['get', 'point_count'],
          source === 'private' ? 8 : 15,
          10,
          source === 'private' ? 12 : 20,
        ],
        // "circle-blur": .5
        // "circle-stroke-color": "white",
        // "circle-stroke-width": 1
      },
    });

    map.addLayer({
      id: `${source}_cluster-count`,
      type: 'symbol',
      source: sourceId,
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
    });

    map.addLayer({
      id: `${source}_unclustered-point`,
      type: 'symbol',
      source: sourceId,
      filter: ['!', ['has', 'point_count']],
      layout: {
        'text-field': ['get', 'name'],
        'text-size': source === 'private' ? 15 : source === 'personal' ? 25 : 19,
        'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
        'text-radial-offset': 0.6,
        'text-justify': 'auto',
        'icon-image': source === 'private' ? 'rocket-15' : 'library-15', // https://api.mapbox.com/styles/v1/mapbox/light-v10/sprite.json?access_token=
        // "icon-image": ["get", "icon"],
        // "icon-image": "{icon}-15", //library-15
        // "icon-image": "logo",
        'icon-size': 1,
        // "text-allow-overlap": true,
        'icon-allow-overlap': true,
      },
      paint: {
        'text-color': source === 'private' ? 'black' : 'hsla(198, 14%, 20%, 1)',
        'text-halo-color': '#fff',
        'text-halo-width': source === 'private' ? 0 : 2,
      },
    });
  }

  addLayers();

  map.on('click', `${source}_clusters`, function (e) {
    var features = map.queryRenderedFeatures(e.point, {
      layers: [`${source}_clusters`],
    });
    var clusterId = features[0].properties.cluster_id;
    map.getSource(sourceId).getClusterExpansionZoom(clusterId, function (err, zoom) {
      if (err) return;

      map.easeTo({
        center: features[0].geometry.coordinates,
        zoom: zoom,
      });
    });
  });

  map.on('mouseenter', `${source}_clusters`, function () {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', `${source}_clusters`, function () {
    map.getCanvas().style.cursor = '';
  });

  map.on('click', `${source}_unclustered-point`, function (e) {
    var coordinates = e.features[0].geometry.coordinates.slice();
    var properties = e.features[0].properties;

    // Ensure that if the map is zoomed out such that multiple
    // copies of the feature are visible, the popup appears
    // over the copy being pointed to.
    while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
      coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
    }

    map.setCenter(coordinates);
    selectedDictionaryId = properties.id;
  });

  map.on('mouseenter', `${source}_unclustered-point`, function () {
    map.getCanvas().style.cursor = 'pointer';
  });

  map.on('mouseleave', `${source}_unclustered-point`, function () {
    map.getCanvas().style.cursor = '';
  });

  map.on('style.load', function () {
    addLayers();

    // Always add the same custom soruces and layers after a style change

    // for (var i = 0; i < customLayers.length; i++) {
    //   var me = customLayers[i];
    //   map.addSource(me.layer.source, me.source);
    //   map.addLayer(me.layer, "waterway-label");
    // }
  });
</script>
