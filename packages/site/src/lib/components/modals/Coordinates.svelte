<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { onMount } from 'svelte';
  import mapboxgl from 'mapbox-gl';

  import Modal from '$lib/components/ui/Modal.svelte';
  import { startCoordinates } from '$lib/components/home/map.class';
  import type { IDictionary } from '@ld/types';
  let map: mapboxgl.Map;
  let marker: mapboxgl.Marker;

  export let dictionary: Partial<IDictionary> = {};
  let lng: number;
  let lat: number;
  let center: [number, number];
  let zoom = 2;

  $: if (map) {
    setMarker(lng, lat);
  }

  function setMarker(longitude, latitude) {
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

  onMount(async () => {
    if (dictionary.coordinates) {
      lng = dictionary.coordinates.longitude;
      lat = dictionary.coordinates.latitude;
      center = [lng, lat];
      zoom = 6;
    } else {
      // @ts-ignore
      center = startCoordinates.DC;
      zoom = 4;
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
          center = [position.coords.longitude, position.coords.latitude];
          if (map) {
            map.flyTo({
              center,
            });
          }
        });
      }
    }

    await loadStylesOnce('https://api.mapbox.com/mapbox-gl-js/v1.8.1/mapbox-gl.css');

    mapboxgl.accessToken = import.meta.env.VITE_mapboxAccessToken;

    map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/mapbox/streets-v11?optimize=true', // outdoors-v9
      center,
      zoom,
    });

    setMarker(lng, lat);

    map.on('click', (event) => {
      setMarker(event.lngLat.lng, event.lngLat.lat);
      // const coordinates = [event.lngLat.lng, event.lngLat.lat];
      // const newMarker = new GeoJson(coordinates, { message: "test message" });
    });

    map.on('load', async () => {
      function setMarkerOnSearchedCoordinates(item) {
        setMarker(item.geometry.coordinates[0], item.geometry.coordinates[1]);
        return item.place_name;
      }

      await loadStylesOnce(
        'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-geocoder/v4.5.1/mapbox-gl-geocoder.css'
      );
      await loadScriptOnce(
        'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-geocoder/v4.5.1/mapbox-gl-geocoder.min.js'
      );
      map.addControl(
        //@ts-ignore
        new MapboxGeocoder({
          accessToken: mapboxgl.accessToken,
          mapboxgl: mapboxgl,
          getItemValue: setMarkerOnSearchedCoordinates,
          placeholder: $_('about.search'),
        })
      );

      map.addControl(new mapboxgl.NavigationControl());
    });

    return () => {
      map.remove();
    };
  });

  function toggleStyle() {
    const style = map.getStyle();
    if (style.name === 'Mapbox Streets') {
      map.setStyle('mapbox://styles/mapbox/satellite-streets-v11?optimize=true');
    } else {
      map.setStyle('mapbox://styles/mapbox/streets-v11?optimize=true'); // style.name === "Mapbox Satellite Streets"
    }
  }

  import { createEventDispatcher } from 'svelte';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import { loadScriptOnce, loadStylesOnce } from '$sveltefirets';
  const dispatch = createEventDispatcher<{
    save: { lat: number; lng: number; dictionary: Partial<IDictionary> };
    remove: { dictionary: Partial<IDictionary> };
    close: boolean;
  }>();
  async function save() {
    dispatch('save', {
      lat,
      lng,
      dictionary,
    });
    dispatch('close');
  }
  async function remove() {
    dispatch('remove', {
      dictionary,
    });
    dispatch('close');
  }
</script>

<Modal on:close>
  <span slot="heading">
    {$_('create.select_coordinates', { default: 'Select Coordinates' })}
    {#if dictionary && dictionary.name}- {dictionary.name}{/if}
  </span>
  <form on:submit|preventDefault={save}>
    <div class="flex flex-wrap items-center mb-2">
      <div class="flex flex-grow">
        <div class="relative">
          <div
            class="absolute inset-y-0 flex items-center text-sm text-gray-500
            uppercase left-0 pl-2 pointer-events-none">
            Lat
          </div>
          <input
            type="number"
            step=".001"
            required
            max="90"
            min="-90"
            bind:value={lat}
            class="w-32 pl-10 pr-3 py-2 form-input"
            placeholder={$_('dictionary.latitude', { default: 'Latitude' })} />
        </div>
        <div class="w-1" />

        <div class="relative">
          <div
            class="absolute inset-y-0 flex items-center text-sm text-gray-500
            uppercase left-0 pl-2 pointer-events-none">
            Lng
          </div>
          <input
            type="number"
            step=".001"
            required
            max="180"
            min="-180"
            bind:value={lng}
            class="w-32 md:w-36 pl-10 pr-3 py-2 form-input"
            placeholder={$_('dictionary.longitude', { default: 'Longitude' })} />
        </div>
      </div>
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

    <div class="modal-footer space-x-1">
      <Button onclick={remove} form="simple" color="red">
        {$_('misc.remove', { default: 'Remove' })}
      </Button>
      <Button type="submit" form="filled">
        {$_('misc.save', { default: 'Save' })}
      </Button>
    </div>
  </form>
</Modal>
