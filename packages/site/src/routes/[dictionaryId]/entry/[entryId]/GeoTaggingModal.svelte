<script lang="ts">
  import { t } from 'svelte-i18n';
  import { Modal, Button, ShowHide } from 'svelte-pieces';
  import Map from '@living-dictionaries/parts/src/lib/maps/mapbox/map/Map.svelte';
  import NavigationControl from '@living-dictionaries/parts/src/lib/maps/mapbox/controls/NavigationControl.svelte';
  import type { Coordinates, IPoint, IRegion } from '@living-dictionaries/types';
  import { onMount, createEventDispatcher } from 'svelte';
  import ToggleStyle from '@living-dictionaries/parts/src/lib/maps/mapbox/controls/ToggleStyle.svelte';
  import Marker from '@living-dictionaries/parts/src/lib/maps/mapbox/map/Marker.svelte';
  import Popup from '@living-dictionaries/parts/src/lib/maps/mapbox/map/Popup.svelte';
  import CoordinatesModal from '@living-dictionaries/parts/src/lib/maps/CoordinatesModal.svelte';
  import RegionModal from '@living-dictionaries/parts/src/lib/maps/RegionModal.svelte';
  import Region from '@living-dictionaries/parts/src/lib/maps/mapbox/map/Region.svelte';

  export let coordinates: Coordinates;

  const style_id = 'mapbox://styles/mapbox/outdoors-v12?optimize=true';
  let lng: number;
  let lat: number;

  const dispatch = createEventDispatcher<{
    close: boolean;
    valueupdate: { field: string; newValue: Coordinates };
  }>();

  function savePoints(points: IPoint[]) {
    dispatch('valueupdate', { field: 'co', newValue: { ...coordinates, points}})
  }

  function saveRegions(regions: IRegion[]) {
    dispatch('valueupdate', { field: 'co', newValue: { ...coordinates, regions}})
  }

  onMount(() => {
    if (coordinates?.points?.[0]) {
      const [{ coordinates: { longitude, latitude } }] = coordinates.points;
      lng = longitude
      lat = latitude
    } else if (coordinates?.regions?.[0]) {
      const [{ coordinates: [{ longitude, latitude }] }] = coordinates.regions;
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
    <Map style={style_id} {lng} {lat} zoom={6}>
      <NavigationControl />
      {#each coordinates?.points || [] as point, index (point)}
        <Marker lat={point.coordinates.latitude} lng={point.coordinates.longitude}>
          <Popup>
            <ShowHide let:show let:toggle>
              <Button form="simple" size="sm" onclick={toggle}>
                <span class="i-octicon-pencil" />
              </Button>
              {#if show}
                <CoordinatesModal
                  {t}
                  lng={point.coordinates.longitude}
                  lat={point.coordinates.latitude}
                  on:update={({ detail }) => {
                    const { points } = coordinates;
                    points[index] = {
                      coordinates: { longitude: detail.lng, latitude: detail.lat },
                    };
                    savePoints(points)
                  }}
                  on:remove={() => {
                    const {points} = coordinates;
                    points.splice(index, 1);
                    savePoints(points)
                  }}
                  on:close={toggle}>
                </CoordinatesModal>
              {/if}
            </ShowHide>
          </Popup>
        </Marker>
      {/each}

      {#each coordinates?.regions || [] as region, index (region)}
        <Region {region}>
          <ShowHide let:show let:toggle>
            <Button form="simple" size="sm" onclick={toggle}>
              <span class="i-octicon-pencil" />
            </Button>
            {#if show}
              <RegionModal
                {t}
                {region}
                on:update={({ detail }) => {
                  const {regions} = coordinates;
                  regions[index] = detail;
                  saveRegions(regions)
                }}
                on:remove={() => {
                  const {regions} = coordinates;
                  regions.splice(index, 1);
                  saveRegions(regions)
                }}
                on:close={toggle}>
              </RegionModal>
            {/if}
          </ShowHide>
        </Region>
      {/each}

      <ToggleStyle />
    </Map>

    <div class="mt-1">
      <ShowHide let:show let:toggle>
        <Button
          onclick={toggle}
          color="black"
          size="sm">
          <span class="i-mdi-map-marker-plus mr-1" style="margin-top: -3px;" />
          {$t('create.select_coordinates', { default: 'Select Coordinates' })}
        </Button>
        {#if show}
          <CoordinatesModal {t} lng={lng} lat={lat} on:update={({ detail }) => {
            const newPoint = { coordinates: { longitude: detail.lng, latitude: detail.lat }}
            const points = [...(coordinates?.points || []), newPoint];
            savePoints(points)
          }} on:close={toggle} />
        {/if}
      </ShowHide>

      <ShowHide let:show let:toggle>
        <Button onclick={toggle} color="black" size="sm">
          <span class="i-mdi-map-marker-path mr-1" style="margin-top: -2px;" />
          {$t('create.select_region', { default: 'Select Region' })}
        </Button>
        {#if show}
          <RegionModal
            {t}
            region={null}
            on:update={({ detail }) => {
              const regions = [...(coordinates?.regions || []), detail];
              saveRegions(regions)
            }}
            on:close={toggle} />
        {/if}
      </ShowHide>
    </div>
  </div>

  <div class="modal-footer">
    <Button onclick={() => dispatch('close')} form="simple" color="black">
      {$t('misc.close')}
    </Button>
  </div>
</Modal>
