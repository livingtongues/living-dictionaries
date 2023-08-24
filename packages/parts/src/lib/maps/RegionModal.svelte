<script lang="ts">
  import type { Readable } from 'svelte/store';
  export let t: Readable<any> = undefined;

  import { onMount, createEventDispatcher } from 'svelte';
  import { Button, Modal, ReactiveSet } from 'svelte-pieces';
  import Map from './mapbox/map/Map.svelte';
  import Geocoder from './mapbox/geocoder/Geocoder.svelte';
  import Marker from './mapbox/map/Marker.svelte';
  import ToggleStyle from './mapbox/controls/ToggleStyle.svelte';
  import NavigationControl from './mapbox/controls/NavigationControl.svelte';
  import type { IRegion } from '@living-dictionaries/types';
  import GeoJSONSource from './mapbox/sources/GeoJSONSource.svelte';
  import { polygonFeatureCoordinates } from './utils/polygonFromCoordinates';
  import Layer from './mapbox/map/Layer.svelte';
  import { randomColor } from './utils/randomColor';
  import Popup from './mapbox/map/Popup.svelte';
  import { points } from '@turf/helpers';
  import center from '@turf/center';

  export let region: IRegion;
  const zoom = region ? 4 : 2;

  let centerLng: number;
  let centerLat: number;

  if (region) {
    const features = points(
      region.coordinates.map(({ longitude, latitude }) => [longitude, latitude])
    );
    const c = center(features);
    if (c?.geometry?.coordinates) [centerLng, centerLat] = c.geometry.coordinates;
  }

  function handleGeocoderResult({ detail }, add) {
    if (detail?.user_coordinates?.[0])
      add({ longitude: detail.user_coordinates[0], latitude: detail.user_coordinates[1] });
    else
      add({ longitude: detail.center[0], latitude: detail.center[1] });

  }

  onMount(() => {
    if (!region && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        centerLng = position.coords.longitude;
        centerLat = position.coords.latitude;
      });
    }
  });

  const dispatch = createEventDispatcher<{
    update: IRegion;
    remove: boolean;
    close: boolean;
  }>();
  function update(coordinates: IRegion['coordinates']) {
    dispatch('update', { coordinates });
    dispatch('close');
  }
  function removeRegion() {
    dispatch('remove');
    dispatch('close');
  }
</script>

<ReactiveSet input={region?.coordinates || []} let:value={points} let:add let:size let:remove>
  <Modal on:close noscroll>
    <span slot="heading">
      {t ? $t('create.select_region') : 'Select Region'}
    </span>
    <form on:submit|preventDefault={() => update(points)}>
      <form on:submit={(e) => e.preventDefault()} style="height: 50vh;">
        <Map
          lng={centerLng}
          lat={centerLat}
          {zoom}
          on:click={({ detail: { lng, lat } }) => add({ longitude: lng, latitude: lat })}>
          <slot />
          <NavigationControl />
          <Geocoder
            options={{ marker: false }}
            placeholder={t ? $t('about.search') : 'Search'}
            on:result={(e) => handleGeocoderResult(e, add)}
            on:error={(e) => console.error(e.detail)} />
          {#each Array.from(points) as point (point)}
            <Marker
              draggable
              on:dragend={({ detail: { lng, lat } }) => {
                remove(point);
                add({ longitude: lng, latitude: lat });
              }}
              lng={point.longitude}
              lat={point.latitude}>
              <Popup>
                <Button form="simple" size="sm" color="red" onclick={() => remove(point)}
                ><span class="i-fa-trash-o" /></Button>
              </Popup>
            </Marker>
          {/each}
          {#if size > 2}
            <GeoJSONSource
              data={{
                type: 'Feature',
                geometry: {
                  type: 'Polygon',
                  coordinates: polygonFeatureCoordinates(points),
                },
                properties: undefined,
              }}>
              <Layer
                options={{
                  type: 'fill',
                  paint: {
                    'fill-color': randomColor(),
                    'fill-opacity': 0.5,
                  },
                }} />
              <Layer
                options={{
                  type: 'line',
                  paint: {
                    'line-color': '#555555',
                    'line-width': 1,
                  },
                }} />
            </GeoJSONSource>
          {/if}
          <ToggleStyle />
        </Map>
      </form>

      <div class="modal-footer">
        <Button onclick={() => dispatch('close')} form="simple" color="black">
          {t ? $t('misc.cancel') : 'Cancel'}
        </Button>
        <Button onclick={removeRegion} form="simple" color="red">
          {t ? $t('misc.remove') : 'Remove'}
        </Button>
        <Button type="submit" form="filled" disabled={size < 3}>
          {t ? $t('misc.save') : 'Save'}
        </Button>
      </div>
    </form>
  </Modal>
</ReactiveSet>
