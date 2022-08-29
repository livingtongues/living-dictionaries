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
  import type { IRegion } from '@living-dictionaries/types';
  import GeoJSONSource from './mapbox/sources/GeoJSONSource.svelte';
  import { polygonFeatureCoordinates } from './utils/polygonFromCoordinates';
  import Layer from './mapbox/map/Layer.svelte';
  import { randomColor } from './utils/randomColor';
  import ReactiveSet from 'svelte-pieces/functions/ReactiveSet.svelte';
  import Popup from './mapbox/map/Popup.svelte';

  import { points } from '@turf/helpers';
  import center from '@turf/center';

  export let region: IRegion;
  let zoom = region ? 4 : 2;

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
    if (detail?.user_coordinates?.[0]) {
      add({ longitude: detail.user_coordinates[0], latitude: detail.user_coordinates[1] });
    } else {
      add({ longitude: detail.center[0], latitude: detail.center[1] });
    }
  }

  onMount(async () => {
    if (!region && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        centerLng = position.coords.longitude;
        centerLat = position.coords.latitude;
      });
    }
  });

  const dispatch = createEventDispatcher<{
    update: { coordinates: IRegion['coordinates'] };
    remove: boolean;
    close: boolean;
  }>();
  async function update(coordinates: IRegion['coordinates']) {
    dispatch('update', { coordinates });
    dispatch('close');
  }
  async function removeRegion() {
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
          <Geocoder
            options={{ marker: false }}
            placeholder={t ? $t('about.search') : 'Search'}
            on:result={(e) => handleGeocoderResult(e, add)}
            on:error={(e) => console.log(e.detail)} />
          {#each Array.from(points) as point (point)}
            <Marker
              draggable
              on:dragend={({ detail: { lng, lat } }) => {
                remove(point);
                add({ longitude: lng, latitude: lat });
              }}
              lng={point.longitude}
              lat={point.latitude}
              let:marker>
              <Popup {marker}>
                <Button form="simple" size="sm" color="red" onclick={() => remove(point)}
                  ><span class="i-fa-trash-o" /></Button>
              </Popup>
            </Marker>
          {/each}
          {#if size > 2}
            <GeoJSONSource
              id="region"
              data={{
                type: 'Feature',
                geometry: {
                  type: 'Polygon',
                  coordinates: polygonFeatureCoordinates(points),
                },
                properties: undefined,
              }}>
              <Layer
                id="regionFill"
                options={{
                  type: 'fill',
                  paint: {
                    'fill-color': randomColor(),
                    'fill-opacity': 0.5,
                  },
                }} />
              <Layer
                id="regionOutline"
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
