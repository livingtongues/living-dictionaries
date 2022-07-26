<script lang="ts">
  import { onMount } from 'svelte';
  import mapboxgl from 'mapbox-gl';
  import Modal from 'svelte-pieces/ui/Modal.svelte';
  import { loadStylesOnce } from './loader';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import { createLayer } from './layer';
  import type { Readable } from 'svelte/store';

  let map: mapboxgl.Map;
  let currentMarker: mapboxgl.Marker;
  let markers: mapboxgl.Marker[] = [];
  let marker: mapboxgl.Marker;
  let lng: number;
  let lat: number;
  let markerText: string = "Default text";
  let layer: mapboxgl.CustomLayerInterface;
  let conuterMarkerId = 0;

  export let markersConfig:mapboxgl.MarkerOptions;
  //export let specialMarkerConfig:mapboxgl.MarkerOptions = undefined; 
  export let t: Readable<any> = undefined;
  export let allowPopup = false;
  export let allowText = false;
  export let intuitiveMarkers = true
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

  // This is to point to the pin that one can remove after grabbing it.
  let pin;
  $: if (currentMarker) {
    if (!pin) {
      pin = trackSelectedPin();
      pin.style.outlineColor = 'red';
      pin.style.outlineStyle = 'solid';
    } else {
     let oldPin = pin
     pin = trackSelectedPin();
     oldPin.style.outlineColor = null;
     oldPin.style.outlineStyle = null;
     pin.style.outlineColor = 'red';
     pin.style.outlineStyle = 'solid'
   }
  }

  function trackSelectedPin() {
    return markers.find((marker) => marker.getElement().id === currentMarker.getElement().id).getElement();
  }

  onMount(async () => {
    await loadStylesOnce('https://api.mapbox.com/mapbox-gl-js/v1.8.1/mapbox-gl.css');
    mapboxgl.accessToken = import.meta.env.VITE_mapboxAccessToken as string;
    map = new mapboxgl.Map({
          container: 'map',
          style: 'mapbox://styles/mapbox/streets-v11?optimize=true', // style URL
          center: [-104.5, 34], // starting position [lng, lat]
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
		markers = [...markers, marker];

    if (allowPopup) {
      const popup = new mapboxgl.Popup({ closeOnClick: false })
        .setLngLat(marker.getLngLat())
        .setText(allowText ? markerText : markers.length.toString())
        .addTo(map);
      marker.setPopup(popup);
    }
  
    map.flyTo({
      center: [lng, lat]
    });
    marker.on('dragstart', () => {
      currentMarker = marker;
    });
    
    marker.getElement().setAttribute('id', conuterMarkerId.toString());
		console.log('marker created', markers);
    conuterMarkerId++;
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
    if (!currentMarker.isDraggable()) {
      alert("You can't delete pinned markers");
      return false;
    }
    currentMarker.remove();
    markers.splice(markers.indexOf(currentMarker), 1);
    if (allowPopup && !allowText) {
      let index = 1;
      markers.forEach((marker) => {
        marker.getPopup().setText((index).toString())
        index++;
      });
    }
    currentMarker =  null;
    }
	

  function setLayer() {
    layer = createLayer(markers, intuitiveMarkers);
    map.addLayer(layer);
  }

  function removeLayer() {
    if (layer) {
      map.removeLayer(layer.id)
      layer = null;
    }
  }
  
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{
    //TODO should be an array of {lat, lng} and maybe a new boolean field for Layers?
    update: [];
    remove: boolean;
    close: boolean;
  }>();
  async function update() {
    dispatch('update', []);
    dispatch('close');
  }
  async function remove() {
    dispatch('remove');
    dispatch('close');
  }
</script>
<Modal on:close noscroll>
  <form on:submit|preventDefault={update}>
    {#if !onlyMultiMarkers}   
      <div class="mb-2">
        <input id="multiple-markers" type="checkbox" bind:checked={multipleMarkers} placeholder="Multiple markers" />
        <label for="multiple-markers" class="text-sm font-medium text-gray-700">Multiple markers</label>
      </div>
    {/if}
    {#if allowPopup && allowText}
      <div class="mb-2">
        <input id="multiple-markers" type="text" placeholder="Text in markers" bind:value={markerText} />
        <!-- <label for="multiple-markers" class="text-sm font-medium text-gray-700">Text in markers</label> -->
      </div>
    {/if}
    <div id="map" class="relative w-full" style="height: 50vh;">
      <button
        on:click={toggleStyle}
        type="button"
        class="px-2 py-1 absolute rounded shadow bg-white"
        style="bottom: 40px; left: 8px; z-index: 1;">
        <i class="far fa-globe-asia" />
      </button>
    </div>
    <div class="modal-footer flex {markers.length > 0 ? 'justify-between' : 'justify-end'}">
      {#if markers.length > 0}
        <div>
          {#if currentMarker}    
            <Button
              color="red"
              form="filled"
              onclick={removeMarker}>
              {t ? $t('misc.delete') : 'Delete Pin'}
            </Button>
          {/if}
          {#if markers.length > 2}
            {#if layer}
              <Button color="red" onclick={removeLayer}>
                {t ? $t('') : 'Remove Layer'}
              </Button>
            {:else}
              <Button color="primary" onclick={setLayer}>
                {t ? $t('') : 'Create Layer'}
              </Button>
            {/if}
          {/if}
        </div>
      {/if}
      <div>
        <Button onclick={remove} form="simple" color="red">
          {t ? $t('misc.remove') : 'Remove'}
        </Button>
        <Button type="submit" form="filled">
          {t ? $t('misc.save') : 'Save'}
        </Button>
      </div>
    </div>
  </form>
</Modal>