<script lang="ts">
  import { onMount } from 'svelte';
  import mapboxgl from 'mapbox-gl';
  import Modal from 'svelte-pieces/ui/Modal.svelte';
  import { loadStylesOnce } from './loader';

  let map: mapboxgl.Map;
  let currentMarker: number;
  let markers: mapboxgl.Marker[] = [];
  let marker: mapboxgl.Marker;
  let lng: number;
  let lat: number;
  //TODO make this a prop
  const markersConfig = { color: '#0d8529', scale: 1.2, draggable: true };
  let multipleMarkers = false;

  $: if (multipleMarkers) {
    marker.remove()
  } else {
    markers.forEach(marker => marker.remove()); 
    markers = []
  } 

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
          if (multipleMarkers) {
            addNewMarker(event.lngLat.lng, event.lngLat.lat);
          } else {
            setSingleMarker(event.lngLat.lng, event.lngLat.lat);
          }
        });
  })

  function convertCoordinates(longitude: number, latitude: number) {
    if (map && longitude && latitude) {
      if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
        return;
      }
      if (marker) {
        marker.remove();
      }
      lng = Math.floor(longitude * 1000) / 1000;
      lat = Math.floor(latitude * 1000) / 1000;
    }
  }

  function addNewMarker(longitude: number, latitude: number) {
    convertCoordinates(longitude, latitude);
		const marker = new mapboxgl.Marker(markersConfig).setLngLat([lng, lat]).addTo(map);
		markers.push(marker);

		const popup = new mapboxgl.Popup({ closeOnClick: false })
			.setLngLat(marker.getLngLat())
			.setText(markers.length.toString())
			.addTo(map);
		marker.setPopup(popup);

		map.flyTo({
			center: [lng, lat]
		});
		marker.on('dragend', () => {
      // @ts-ignore I'm ignoring next line due to ._container is a private Popup property and it's not declared in the class, but mapbox doesn't bring us a method where we can get the text of a popup
			currentMarker = parseInt(marker.getPopup()._container.innerText.replace('\nx', '')) - 1;
			console.log(marker.getPopup());
		});
		console.log('marker created', markers);
	}

  function setSingleMarker(longitude: number, latitude: number) {
    convertCoordinates(longitude, latitude);
    marker = new mapboxgl.Marker().setLngLat([lng, lat]).addTo(map);
    map.flyTo({
      center: [lng, lat],
    });
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
  <form>
    <div class="mb-2">
      <input id="multiple-markers" type="checkbox" bind:checked={multipleMarkers} placeholder="Multiple markers" />
      <label for="multiple-markers" class="text-sm font-medium text-gray-700">Multiple markers</label>
    </div>
    <div id="map" class="relative w-full" style="height: 50vh;">
      <button
        on:click={toggleStyle}
        type="button"
        class="px-2 py-1 absolute rounded shadow bg-white"
        style="bottom: 40px; left: 8px; z-index: 1;">
        <i class="far fa-globe-asia" />
      </button>
    </div>
  </form>
</Modal>