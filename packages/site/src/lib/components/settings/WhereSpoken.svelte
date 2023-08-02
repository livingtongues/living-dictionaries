<script lang="ts">
  import { t } from 'svelte-i18n';
  import { Button, ShowHide } from 'svelte-pieces';
  import type { IDictionary, IPoint, IRegion } from '@living-dictionaries/types';
  import type { LngLat } from 'mapbox-gl';
  import Map from '@living-dictionaries/parts/src/lib/maps/mapbox/map/Map.svelte';
  import Marker from '@living-dictionaries/parts/src/lib/maps/mapbox/map/Marker.svelte';
  import Popup from '@living-dictionaries/parts/src/lib/maps/mapbox/map/Popup.svelte';
  import Region from '@living-dictionaries/parts/src/lib/maps/mapbox/map/Region.svelte';
  import CoordinatesModal from '@living-dictionaries/parts/src/lib/maps/CoordinatesModal.svelte';
  import RegionModal from '@living-dictionaries/parts/src/lib/maps/RegionModal.svelte';
  import NavigationControl from '@living-dictionaries/parts/src/lib/maps/mapbox/controls/NavigationControl.svelte';
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{
    updateCoordinates: { longitude: number; latitude: number };
    removeCoordinates: boolean;
    updatePoints: IPoint[];
    updateRegions: IRegion[];
  }>();

  export let dictionary: Partial<IDictionary>;
  $: hasCoordinates = dictionary.coordinates?.latitude;

  function addCoordinates({ detail }: { detail: { lng: number; lat: number } }) {
    if (hasCoordinates) {
      const point = {
        coordinates: { longitude: detail.lng, latitude: detail.lat },
      };
      const points = (dictionary.points && [...dictionary.points, point]) || [point];
      dispatch('updatePoints', points);
    } else {
      dispatch('updateCoordinates', { longitude: detail.lng, latitude: detail.lat });
    }
  }

  let mapClickCoordinates: LngLat;
</script>

<div class="text-sm font-medium text-gray-700 mb-2">
  {$t('create.where_spoken', { default: 'Where is this language spoken?' })}*
</div>

{#if hasCoordinates}
  <div class="text-xs text-gray-600 mb-2">
    {$t('create.map_instructions', { default: 'Click on the map to add secondary coordinates.' })}
  </div>
  <div class="h-240px">
    <Map
      lng={dictionary.coordinates.longitude}
      lat={dictionary.coordinates.latitude}
      on:click={({ detail }) => (mapClickCoordinates = detail)}>
      <NavigationControl />
      {#if mapClickCoordinates}
        <CoordinatesModal
          {t}
          lng={+mapClickCoordinates.lng.toFixed(4)}
          lat={+mapClickCoordinates.lat.toFixed(4)}
          on:update={addCoordinates}
          on:close={() => (mapClickCoordinates = null)}>
          <Marker
            lng={dictionary.coordinates.longitude}
            lat={dictionary.coordinates.latitude}
            color="blue">
            <Popup offset={30} open>{$t('create.primary_coordinate', { default: 'Primary coordinate' })}</Popup>
          </Marker>
        </CoordinatesModal>
      {/if}
      <Marker
        lat={dictionary.coordinates.latitude}
        lng={dictionary.coordinates.longitude}
        color="blue">
        <Popup>
          <ShowHide let:show let:toggle>
            <Button form="simple" size="sm" onclick={toggle}>
              <span class="i-octicon-pencil" />
            </Button>
            {#if show}
              <CoordinatesModal
                {t}
                lng={dictionary.coordinates.longitude}
                lat={dictionary.coordinates.latitude}
                canRemove={!dictionary.points?.length && !dictionary.regions?.length}
                on:update={({ detail }) =>
                  dispatch('updateCoordinates', { longitude: detail.lng, latitude: detail.lat })}
                on:remove={() => dispatch('removeCoordinates')}
                on:close={toggle} />
            {/if}
          </ShowHide>
        </Popup>
      </Marker>

      {#if dictionary.points}
        {#each dictionary.points as point, index (point)}
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
                      const points = dictionary.points;
                      points[index] = {
                        coordinates: { longitude: detail.lng, latitude: detail.lat },
                      };
                      dispatch('updatePoints', points);
                    }}
                    on:remove={() => {
                      const points = dictionary.points;
                      points.splice(index, 1);
                      dispatch('updatePoints', points);
                    }}
                    on:close={toggle}>
                    <Marker
                      lng={dictionary.coordinates.longitude}
                      lat={dictionary.coordinates.latitude}
                      color="blue">
                      <Popup offset={30}>Primary coordinate</Popup>
                    </Marker>
                  </CoordinatesModal>
                {/if}
              </ShowHide>
            </Popup>
          </Marker>
        {/each}
      {/if}

      {#if dictionary.regions}
        {#each dictionary.regions as region, index (region)}
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
                    const regions = dictionary.regions;
                    regions[index] = detail;
                    dispatch('updateRegions', regions);
                  }}
                  on:remove={() => {
                    const regions = dictionary.regions;
                    regions.splice(index, 1);
                    dispatch('updateRegions', regions);
                  }}
                  on:close={toggle}>
                  <Marker
                    lng={dictionary.coordinates.longitude}
                    lat={dictionary.coordinates.latitude}
                    color="blue">
                    <Popup offset={30}>Primary coordinate</Popup>
                  </Marker>
                </RegionModal>
              {/if}
            </ShowHide>
          </Region>
        {/each}
      {/if}
    </Map>
  </div>
{/if}

<div class="mt-1">
  <ShowHide let:show let:toggle>
    <Button
      onclick={toggle}
      color={hasCoordinates ? 'black' : 'primary'}
      size={hasCoordinates ? 'sm' : 'md'}>
      <span class="i-mdi-map-marker-plus mr-1" style="margin-top: -3px;" />
      {#if hasCoordinates}
      {$t('create.select_coordinates', { default: 'Select Coordinates' })}
      {:else}
        {$t('create.select_coordinates', { default: 'Select Coordinates' })}
      {/if}
    </Button>
    {#if show}
      <CoordinatesModal {t} lng={dictionary?.coordinates?.longitude} lat={dictionary?.coordinates?.latitude} on:update={addCoordinates} on:close={toggle}>
        {#if hasCoordinates}
          <Marker
            lng={dictionary.coordinates.longitude}
            lat={dictionary.coordinates.latitude}
            color="blue">
            <Popup offset={30} open>{$t('create.map_instructions', { default: 'Click on the map to add secondary coordinates.' })}</Popup>
          </Marker>
        {/if}
      </CoordinatesModal>
    {/if}
  </ShowHide>

  {#if hasCoordinates}
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
            const regions = (dictionary.regions && [...dictionary.regions, detail]) || [detail];
            dispatch('updateRegions', regions);
          }}
          on:close={toggle}>
          <Marker
            lng={dictionary.coordinates.longitude}
            lat={dictionary.coordinates.latitude}
            color="blue">
            <Popup offset={30} open>{$t('create.map_instructions', { default: 'Click on the map to add secondary coordinates.' })}</Popup>
          </Marker>
        </RegionModal>
      {/if}
    </ShowHide>
  {/if}
</div>
