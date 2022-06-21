<script lang="ts">
  import { onMount } from 'svelte';
  import mapboxgl from 'mapbox-gl';
  import Modal from 'svelte-pieces/ui/Modal.svelte';
  import { loadStylesOnce } from './loader';

  let map: mapboxgl.Map;
  let markers: mapboxgl.Marker[] = [];
  let marker: mapboxgl.Marker;
  let lng: number;
  let lat: number;

  onMount(async () => {
    await loadStylesOnce('https://api.mapbox.com/mapbox-gl-js/v1.8.1/mapbox-gl.css');
    mapboxgl.accessToken = import.meta.env.VITE_mapboxAccessToken as string;
    map = new mapboxgl.Map({
          container: 'map',
          style: 'mapbox://styles/mapbox/streets-v11?optimize=true', // style URL
          center: [-94.5, 88], // starting position [lng, lat]
          zoom: 3 // starting zoom
        });
        map.on('click', (event) => {
          setMarker(event.lngLat.lng, event.lngLat.lat);

        });
  })

  function setMarker(longitude: number, latitude: number) {
    if (map && longitude && latitude) {
      if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
        return;
      }
      if (marker) {
        marker.remove();
      }
      lng = Math.floor(longitude * 1000) / 1000;
      lat = Math.floor(latitude * 1000) / 1000;
      // record to the 3rd decimal point (111 meters) (4th decimal would be handheld GPS accuracy) // https://gis.stackexchange.com/questions/8650/measuring-accuracy-of-latitude-and-longitude, https://gisjames.wordpress.com/2016/04/27/deciding-how-many-decimal-places-to-include-when-reporting-latitude-and-longitude/

      marker = new mapboxgl.Marker().setLngLat([lng, lat]).addTo(map);
      map.flyTo({
        center: [lng, lat],
      });
    }
  }

  function toggleStyle() {
    const style = map.getStyle();
    if (style.name === 'Mapbox Streets') {
      map.setStyle('mapbox://styles/mapbox/satellite-streets-v11?optimize=true');
    } else {
      map.setStyle('mapbox://styles/mapbox/streets-v11?optimize=true'); // style.name === "Mapbox Satellite Streets"
    }
  }
</script>

<Modal on:close noscroll>
  <div id="map" class="relative w-full" style="height: 50vh;">
    <button
      on:click={toggleStyle}
      type="button"
      class="px-2 py-1 absolute rounded shadow bg-white"
      style="bottom: 40px; left: 8px; z-index: 1;">
      <i class="far fa-globe-asia" />
    </button>
  </div>
</Modal>