<script lang="ts">
  import { Modal, Button } from 'svelte-pieces';
  import Map from '@living-dictionaries/parts/src/lib/maps/mapbox/map/Map.svelte';
  import Geocoder from '@living-dictionaries/parts/src/lib/maps/mapbox/geocoder/Geocoder.svelte';
  import NavigationControl from '@living-dictionaries/parts/src/lib/maps/mapbox/controls/NavigationControl.svelte';
  import Marker from '@living-dictionaries/parts/src/lib/maps/mapbox/map/Marker.svelte';
  import type { Readable } from 'svelte/store';
  import type { IEntry } from '@living-dictionaries/types';
  import { onMount, createEventDispatcher } from 'svelte';
  import { updateOnline } from 'sveltefirets';
  import { dictionary } from '$lib/stores';
  export let t: Readable<any> = undefined;
  export let entry:IEntry;

  const username = 'mapbox';
  const width = '450';
  const height = '375';
  const style_id = 'outdoors-v12';
  let overlay;
  let lng:number;
  let lat:number;
  let zoom = 4;
  let pitch = 0;
  let bearing = 0;
  const high_density = true
  let marker_lng:number;
  let marker_lat:number;
  // let color:string = 'black'
  export let canRemove = true;

  function getCoordinatesFromURL(url) {
    const coordinatesMatch = url.match(/\/[-+]?\d+\.?\d+(,[-+]?\d+\.?(\d+)?)+/);

    if (coordinatesMatch){

      const matched =  coordinatesMatch[0];
      const new_array = matched.split(',');
      new_array[0] = new_array[0].substring(1);
      return new_array.map(e => +e)
    }

    return null;
  }


  function add_marker_to_static_image() {
    return `pin-s+000000(${marker_lng},${marker_lat})`;
  }

  function setMarker(longitude: number, latitude: number) {
    if (!(longitude && latitude)) return;
    if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90)
      return;

    marker_lng = +longitude.toFixed(4);
    marker_lat = +latitude.toFixed(4);
  }

  async function saveStaticImage() {
    await updateOnline<IEntry>(`dictionaries/${$dictionary.id}/words/${entry.id}`, { gt: static_image_link }, { abbreviate: true })
  }

  $: if (marker_lat && marker_lng)
    overlay = add_marker_to_static_image();


  $: static_image_link = `https://api.mapbox.com/styles/v1/${username}/${style_id}/static/${overlay ? overlay + '/' : ''}${lng},${lat},${zoom},${bearing},${pitch}/${width}x${height}${high_density ? '@2x' : ''}?access_token=`;

  onMount(() => {
    if (entry.gt) {
      [lng, lat, zoom, bearing, pitch] = getCoordinatesFromURL(entry.gt);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        lng = position.coords.longitude;
        lat = position.coords.latitude;
      });
    }
  });

  const dispatch = createEventDispatcher<{
    remove: boolean;
    close: boolean;
  }>();
  function remove() {
    dispatch('remove');
    dispatch('close');
  }
</script>

<Modal on:close noscroll>
  <form on:submit|preventDefault={saveStaticImage}>
    <div style="width: {width}px;height: {height}px;">
      <Map {lng} {lat}
        on:pitchend={({ detail }) => ([pitch, bearing] = detail)}
        on:dragend={({ detail }) => ({ lng, lat } = detail)}
        on:zoomend={({ detail }) => zoom = detail}
        on:click={({ detail }) => setMarker(detail.lng, detail.lat)}>
        <NavigationControl />
        <Geocoder
          options={{ marker: false }}
          placeholder={t ? $t('about.search') : 'Search'}
          on:result={({ detail }) => ([lng, lat] = detail.center)}
          on:error={(e) => console.error(e.detail)} />
        {#if marker_lng && marker_lat}
          <Marker
            draggable
            on:dragend={({ detail }) => setMarker(detail.lng, detail.lat)}
            lng={marker_lng}
            lat={marker_lat} />
        {/if}
      </Map>
    </div>

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
