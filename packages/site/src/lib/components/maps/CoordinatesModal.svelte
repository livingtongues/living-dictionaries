<script lang="ts">
  import { page } from '$app/stores';
  import { onMount, createEventDispatcher } from 'svelte';
  import { Button, Modal } from 'svelte-pieces';
  import Map from './mapbox/map/Map.svelte';
  import Geocoder from './mapbox/geocoder/Geocoder.svelte';
  import Marker from './mapbox/map/Marker.svelte';
  import ToggleStyle from './mapbox/controls/ToggleStyle.svelte';
  import NavigationControl from './mapbox/controls/NavigationControl.svelte';
  import { setMarker } from './utils/setCoordinatesToMarker';
  import type { LngLatFull } from '@living-dictionaries/types/coordinates.interface';

  export let initialCenter: LngLatFull = undefined;
  export let lng: number = undefined;
  export let lat: number = undefined;
  export let canRemove = true;

  let centerLng = lng;
  let centerLat = lat;

  const zoom = lng && lat ? 6 : 3;

  onMount(() => {
    if (lng && lat) return;
    if (initialCenter) {
      ({longitude: centerLng, latitude: centerLat} = initialCenter);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        centerLng = position.coords.longitude;
        centerLat = position.coords.latitude;
      });
    }
  });

  function handleGeocoderResult({ detail }) {
    if (detail?.user_coordinates?.[0])
      setMarker(detail.user_coordinates[0], detail.user_coordinates[1]);
    else
      setMarker(detail.center[0], detail.center[1]);
  }

  const dispatch = createEventDispatcher<{
    update: { lat: number; lng: number };
    remove: boolean;
    close: boolean;
  }>();
  function update() {
    dispatch('update', {
      lat,
      lng,
    });
    dispatch('close');
  }
  function remove() {
    dispatch('remove');
    dispatch('close');
  }
</script>

<Modal on:close noscroll>
  <span slot="heading">
    {$page.data.t('create.select_coordinates')}
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
            placeholder={$page.data.t('dictionary.latitude')} />
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
            placeholder={$page.data.t('dictionary.longitude')} />
        </div>
      </div>
    </div>

    <form on:submit={(e) => e.preventDefault()} style="height: 50vh;">
      <Map
        lng={centerLng}
        lat={centerLat}
        {zoom}
        on:click={({ detail }) => ({lng, lat} = setMarker(detail.lng, detail.lat))}>
        <slot />
        <NavigationControl />
        <Geocoder
          options={{ marker: false }}
          placeholder={$page.data.t('about.search')}
          on:result={handleGeocoderResult}
          on:error={(e) => console.error(e.detail)} />
        {#if lng && lat}
          <Marker
            draggable
            on:dragend={({ detail }) => ({lng, lat} = setMarker(detail.lng, detail.lat))}
            {lng}
            {lat} />
        {/if}
        <ToggleStyle />
      </Map>
    </form>

    <div class="modal-footer">
      <Button onclick={() => dispatch('close')} form="simple" color="black">
        {$page.data.t('misc.cancel')}
      </Button>
      {#if canRemove}
        <Button onclick={remove} form="simple" color="red">
          {$page.data.t('misc.remove')}
        </Button>
      {/if}
      <Button type="submit" form="filled">
        {$page.data.t('misc.save')}
      </Button>
    </div>
  </form>
</Modal>
