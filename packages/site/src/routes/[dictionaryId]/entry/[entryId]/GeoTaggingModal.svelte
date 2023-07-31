<script lang="ts">
  import { Modal, Button } from 'svelte-pieces';
  import Map from '@living-dictionaries/parts/src/lib/maps/mapbox/map/Map.svelte';
  import Geocoder from '@living-dictionaries/parts/src/lib/maps/mapbox/geocoder/Geocoder.svelte';
  import NavigationControl from '@living-dictionaries/parts/src/lib/maps/mapbox/controls/NavigationControl.svelte';
  import type { Readable } from 'svelte/store';
  import { onMount, createEventDispatcher } from 'svelte';
  export let t: Readable<any> = undefined;

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
  export let canRemove = true;

  $: static_image_link = `https://api.mapbox.com/styles/v1/${username}/${style_id}/static/${overlay ? overlay + '/' : ''}${lng},${lat},${zoom},${bearing},${pitch}/${width}x${height}${high_density ? '@2x' : ''}?access_token=`;

  onMount(() => {
    if (navigator.geolocation) {
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
  <form on:submit|preventDefault style="width: {width}px;height: {height}px;">
    <Map {lng} {lat}
      on:pitchend={({ detail }) => ([pitch, bearing] = detail)}
      on:dragend={({ detail }) => ({ lng, lat } = detail)}
      on:zoomend={({ detail }) => zoom = detail}>
      <NavigationControl />
      <Geocoder
        options={{ marker: false }}
        placeholder={t ? $t('about.search') : 'Search'}
        on:result={({ detail }) => ([lng, lat] = detail.center)}
        on:error={(e) => console.error(e.detail)} />
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
  {static_image_link}
</Modal>
