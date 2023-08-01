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
  import { setMarker } from '@living-dictionaries/parts/src/lib/maps/utils/setCoordinatesToMarker';

  export let t: Readable<any> = undefined;
  export let entry:IEntry;
  const map_styles = ['outdoors-v12', 'streets-v12', 'satellite-v9', 'satellite-streets-v12']
  const username = 'mapbox';
  const width = '450';
  const height = '375';
  let style_id = 'outdoors-v12';
  let overlay:string;
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

  function getDataFromStaticImageURL(url) {
    const coordinatesMatch = url.match(/\/[-+]?\d+\.?\d+(,[-+]?\d+\.?(\d+)?)+/);
    if (coordinatesMatch){
      const [matched] =  coordinatesMatch;
      const staticImageData = matched.split(',');
      staticImageData[0] = staticImageData[0].substring(1);
      return staticImageData.map(e => +e)
    }
    return null;
  }


  function add_marker_to_static_image() {
    return `pin-s+000000(${marker_lng},${marker_lat})`;
  }

  async function saveStaticImage() {
    await updateOnline<IEntry>(`dictionaries/${$dictionary.id}/words/${entry.id}`, { gt: static_image_link }, { abbreviate: true });
    dispatch('close');
  }

  async function remove() {
    if (entry.gt)
      await updateOnline<IEntry>(`dictionaries/${$dictionary.id}/words/${entry.id}`, { gt: '' }, { abbreviate: true });
    dispatch('close');
  }

  $: if (marker_lat && marker_lng)
    overlay = add_marker_to_static_image();

  $: if (pitch > 60)
    pitch = 60

  $: static_image_link = `https://api.mapbox.com/styles/v1/${username}/${style_id}/static/${overlay ? overlay + '/' : ''}${lng},${lat},${zoom},${bearing},${pitch}/${width}x${height}${high_density ? '@2x' : ''}?access_token=`;

  onMount(() => {
    if (entry.gt) {
      [lng, lat, zoom, bearing, pitch] = getDataFromStaticImageURL(entry.gt);
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
</script>

<Modal on:close noscroll>
  <form on:submit|preventDefault={saveStaticImage}>
    <select class="w-full mb-2" bind:value={style_id}>
      {#each map_styles as style}
        <option value={style}>{style}</option>
      {/each}
    </select>
    <div style="width: {width}px;height: {height}px;">
      <Map {lng} {lat} {zoom} {bearing} {pitch}
        on:pitchend={({ detail }) => ({pitch, bearing} = detail)}
        on:dragend={({ detail }) => ({ lng, lat } = detail)}
        on:zoomend={({ detail }) => zoom = detail}
        on:click={({ detail }) => ({lng: marker_lng, lat: marker_lat} = setMarker(detail.lng, detail.lat))}>
        <NavigationControl />
        <Geocoder
          options={{ marker: false }}
          placeholder={t ? $t('about.search') : 'Search'}
          on:result={({ detail }) => ([lng, lat] = detail.center)}
          on:error={(e) => console.error(e.detail)} />
        {#if marker_lng && marker_lat}
          <Marker
            draggable
            on:dragend={({ detail }) => ({lng: marker_lng, lat: marker_lat} = setMarker(detail.lng, detail.lat))}
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
