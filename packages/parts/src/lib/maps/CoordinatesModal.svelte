<script lang="ts">
  import type { Readable } from 'svelte/store';
  export let t: Readable<any> = undefined;

  import { onMount, createEventDispatcher } from 'svelte';
  import Modal from 'svelte-pieces/ui/Modal.svelte';
  import Button from 'svelte-pieces/ui/Button.svelte';
  import Map from './mapbox/map/Map.svelte';
  import Geocoder from './mapbox/geocoder/Geocoder.svelte';
  import Marker from './mapbox/map/Marker.svelte';
  import ToggleStyle from './mapbox/controls/ToggleStyle.svelte';
  import NavigationControl from '../maps/mapbox/controls/NavigationControl.svelte';
  import GeoJSONSource from './mapbox/sources/GeoJSONSource.svelte';
  import Layer from './mapbox/map/Layer.svelte';
  import type { IDictionary } from '@living-dictionaries/types';
  import { dictionaryGeoJsonCollection } from './utils/dictionaryGeoJsonCollection';

  export let lng: number;
  export let lat: number;
  export let canRemove = true;
  export let dictionary: IDictionary = null;

  let centerLng = lng;
  let centerLat = lat;

  let zoom = lng && lat ? 6 : 2;

  function setMarker(longitude: number, latitude: number) {
    if (!(longitude && latitude)) return;
    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
      return;
    }
    lng = +longitude.toFixed(4);
    lat = +latitude.toFixed(4);
  }

  function handleGeocoderResult({ detail }) {
    if (detail?.user_coordinates?.[0]) {
      setMarker(detail.user_coordinates[0], detail.user_coordinates[1]);
    } else {
      setMarker(detail.center[0], detail.center[1]);
    }
  }

  onMount(async () => {
    if (!(lng && lat) && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        centerLng = position.coords.longitude;
        centerLat = position.coords.latitude;
      });
    }
  });

  const dispatch = createEventDispatcher<{
    update: { lat: number; lng: number };
    remove: boolean;
    close: boolean;
  }>();
  async function update() {
    dispatch('update', {
      lat,
      lng,
    });
    dispatch('close');
  }
  async function remove() {
    dispatch('remove');
    dispatch('close');
  }
</script>

<Modal on:close noscroll>
  <span slot="heading">
    {t ? $t('create.select_coordinates') : 'Select Coordinates'}
  </span>
  <form on:submit|preventDefault={update}>
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
            step=".0001"
            required
            max="90"
            min="-90"
            bind:value={lat}
            class="w-32 pl-10 pr-3 py-2 form-input"
            placeholder={t ? $t('dictionary.latitude') : 'Latitude'} />
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
            step=".0001"
            required
            max="180"
            min="-180"
            bind:value={lng}
            class="w-32 md:w-36 pl-10 pr-3 py-2 form-input"
            placeholder={t ? $t('dictionary.longitude') : 'Longitude'} />
        </div>
      </div>
    </div>

    <form on:submit={(e) => e.preventDefault()} style="height: 50vh;">
      <Map
        lng={centerLng}
        lat={centerLat}
        {zoom}
        on:click={({ detail }) => setMarker(detail.lng, detail.lat)}>
        {#if dictionary}   
          <GeoJSONSource
            data={dictionaryGeoJsonCollection([dictionary])}>
            <Layer 
              options={{
                type: 'circle',
                paint: {
                  'circle-color': 'blue',
                  'circle-radius': 14,
                }
              }} />
          </GeoJSONSource>
        {/if}
        <NavigationControl />
        <Geocoder
          options={{ marker: false }}
          placeholder={t ? $t('about.search') : 'Search'}
          on:result={handleGeocoderResult}
          on:error={(e) => console.log(e.detail)} />
        {#if lng && lat}
          <Marker
            draggable
            on:dragend={({ detail }) => setMarker(detail.lng, detail.lat)}
            {lng}
            {lat} />
        {/if}
        <ToggleStyle />
      </Map>
    </form>

    <div class="modal-footer">
      <Button onclick={() => dispatch('close')} form="simple" color="black">
        {t ? $t('misc.cancel') : 'Cancel'}
      </Button>
      {#if canRemove}
        <Button onclick={remove} form="simple" color="red">
          {t ? $t('misc.remove') : 'Remove'}
        </Button>
      {/if}
      <Button type="submit" form="filled">
        {t ? $t('misc.save') : 'Save'}
      </Button>
    </div>
  </form>
</Modal>
