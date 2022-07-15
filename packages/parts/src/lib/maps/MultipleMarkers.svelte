<script lang="ts">
  import { onMount } from 'svelte';
  import mapboxgl from 'mapbox-gl';
  import Modal from 'svelte-pieces/ui/Modal.svelte';
  import { loadStylesOnce } from './loader';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import { createLayer } from './layer';
  import type { Readable } from 'svelte/store';

  let map: mapboxgl.Map;
  let currentMarker: number;
  let markers: mapboxgl.Marker[] = [];
  let marker: mapboxgl.Marker;
  let lng: number;
  let lat: number;
  let markerText: string;
  let layer: mapboxgl.CustomLayerInterface;

  export let t: Readable<any> = undefined;
  export let allowPopup = false;
  export let allowText = false;
  export let allowLayer = false;
  export let markersConfig:mapboxgl.MarkerOptions;
  export let multipleMarkers = false;
  export let onlyMultiMarkers = false;

  if (onlyMultiMarkers) {
    multipleMarkers = true;
  }

  $: if (multipleMarkers) {
    if (marker) {
      marker.remove()
    }
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

    if (allowPopup) {
      const popup = new mapboxgl.Popup({ closeOnClick: false })
        .setLngLat(marker.getLngLat())
        .setText(allowText ? markerText : markers.length.toString())
        .addTo(map);
      marker.setPopup(popup);
  
      map.flyTo({
        center: [lng, lat]
      });
      marker.on('dragend', () => {
        // @ts-ignore I'm ignoring next line due to ._container is a private Popup property and it's not declared in the class, but mapbox doesn't bring us a method where we can get the text of a popup
        currentMarker = markerText ? markerText : parseInt(marker.getPopup()._container.innerText.replace('\nx', '')) - 1;
      });
    }
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

  function removeMarker() {
		//TODO show a confirm alert if they want to remove a fixed marker
    if (allowPopup && !allowText) {
      if (!markers[currentMarker].isDraggable()) {
        alert("You can't delete pinned markers");
        return false;
      }
      markers[currentMarker].remove();
      markers.splice(currentMarker, 1);
      markers.forEach((marker, index) => marker.getPopup().setText((index + 1).toString()));
    } else {
      let markerToDelete = markers.pop();
      markerToDelete.remove();
    }
	}

  function removeLayer() {
    if (layer) {
      map.removeLayer(layer.id)
      layer = null;
    }
  }
</script>
<Modal on:close noscroll>
  <form>
    {#if !onlyMultiMarkers}   
      <div class="mb-2">
        <input id="multiple-markers" type="checkbox" bind:checked={multipleMarkers} placeholder="Multiple markers" />
        <label for="multiple-markers" class="text-sm font-medium text-gray-700">Multiple markers</label>
      </div>
    {/if}
    <!--TODO this text functionality in popups-->
    {#if allowPopup && allowText}
      <div class="mb-2">
        <input id="multiple-markers" type="text" placeholder="Multiple markers" bind:value={markerText} />
        <label for="multiple-markers" class="text-sm font-medium text-gray-700">Text in markers</label>
      </div>
    {/if}
    <div id="map" class="relative w-full mb-2" style="height: 50vh;">
      <button
        on:click={toggleStyle}
        type="button"
        class="px-2 py-1 absolute rounded shadow bg-white"
        style="bottom: 40px; left: 8px; z-index: 1;">
        <i class="far fa-globe-asia" />
      </button>
    </div>
    {#if multipleMarkers}
      <div class="flex justify-between">
        <Button
          color="red"
          form="filled"
          onclick={removeMarker}>
          {t ? $t('misc.delete') : 'Delete Pin'}
        </Button>
        {#if allowLayer}
            {#if layer}
              <Button color="red" onclick={removeLayer}>
                {t ? $t('') : 'Remove Layer'}
              </Button>
            {:else}
              <Button color="primary" onclick={() => {
                layer = createLayer(markers);
                map.addLayer(layer);
              }}>
                {t ? $t('') : 'Create Layer'}
              </Button>
            {/if}
        {/if}
      </div>
    {/if}
  </form>
</Modal>