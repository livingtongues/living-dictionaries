<script lang="ts">
  import { t } from 'svelte-i18n';
  import { Modal, Button } from 'svelte-pieces';
  import Map from '@living-dictionaries/parts/src/lib/maps/mapbox/map/Map.svelte';
  import Geocoder from '@living-dictionaries/parts/src/lib/maps/mapbox/geocoder/Geocoder.svelte';
  import NavigationControl from '@living-dictionaries/parts/src/lib/maps/mapbox/controls/NavigationControl.svelte';
  import Marker from '@living-dictionaries/parts/src/lib/maps/mapbox/map/Marker.svelte';
  import type { Coordinates } from '@living-dictionaries/types';
  import { onMount, createEventDispatcher } from 'svelte';
  import { setMarker } from '@living-dictionaries/parts/src/lib/maps/utils/setCoordinatesToMarker';
  import ToggleStyle from '@living-dictionaries/parts/src/lib/maps/mapbox/controls/ToggleStyle.svelte';

  export let coordinates: Coordinates;

  const style_id = 'mapbox://styles/mapbox/outdoors-v12?optimize=true';
  let lng: number;
  let lat: number;
  let zoom = 4;

  const dispatch = createEventDispatcher<{
    close: boolean;
    valueupdate: { field: string; newValue: Coordinates };
  }>();

  function save() {
    dispatch('valueupdate', { field: 'co', newValue: { points: [{coordinates: {latitude: lat, longitude: lng}}]}})
    dispatch('close');
  }

  function remove() {
    dispatch('valueupdate', { field: 'co', newValue: null})
    dispatch('close');
  }

  onMount(() => {
    if (coordinates?.points?.[0]) {
      const { coordinates: { longitude, latitude } } = coordinates.points[0]
      lng = longitude
      lat = latitude
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        lng = position.coords.longitude;
        lat = position.coords.latitude;
      });
    }
  });
</script>

<Modal on:close noscroll>
  <div class="h-sm">
    <Map style={style_id} {lng} {lat} {zoom}
      on:dragend={({ detail }) => ({ lng, lat } = detail)}
      on:zoomend={({ detail }) => zoom = detail}
      on:click={({ detail }) => ({lng, lat} = setMarker(detail.lng, detail.lat))}>
      <NavigationControl />
      <Geocoder
        options={{ marker: false }}
        placeholder={$t('about.search')}
        on:result={({ detail }) => ([lng, lat] = detail.center)}
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
  </div>

  <div class="modal-footer">
    <Button onclick={() => dispatch('close')} form="simple" color="black">
      {$t('misc.cancel')}
    </Button>
    {#if coordinates}
      <Button onclick={remove} form="simple" color="red">
        {$t('misc.remove')}
      </Button>
    {/if}
    <Button onclick={save} form="filled">
      {$t('misc.save')}
    </Button>
  </div>
</Modal>
