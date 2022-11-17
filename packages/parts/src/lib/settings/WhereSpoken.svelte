<script lang="ts">
  import type { Readable } from 'svelte/store';
  export let t: Readable<any> = undefined;

  import Button from 'svelte-pieces/ui/Button.svelte';
  import ShowHide from 'svelte-pieces/functions/ShowHide.svelte';
  import type { IDictionary, IPoint, IRegion } from '@living-dictionaries/types';
  import type { LngLat } from 'mapbox-gl';
  import Map from '../maps/mapbox/map/Map.svelte';
  import Marker from '../maps/mapbox/map/Marker.svelte';
  import Popup from '../maps/mapbox/map/Popup.svelte';
  import Region from '../maps/mapbox/map/Region.svelte';
  import CoordinatesModal from '../maps/CoordinatesModal.svelte';
  import RegionModal from '../maps/RegionModal.svelte';
  import NavigationControl from '../maps/mapbox/controls/NavigationControl.svelte';

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{
    updateCoordinates: { longitude: number; latitude: number };
    removeCoordinates: boolean;
    updatePoints: IPoint[];
    updateRegions: IRegion[];
  }>();
  
  export let dictionary: IDictionary;
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
  {t ? $t('create.where_spoken') : 'Where is this language spoken?'}*
</div>

{#if hasCoordinates}
  <div class="h-240px">
    <Map
      lng={dictionary.coordinates.longitude}
      lat={dictionary.coordinates.latitude}
      on:click={({ detail }) => (mapClickCoordinates = detail)}>
      <NavigationControl />
      {#if mapClickCoordinates}
        <CoordinatesModal
          {t}
          {dictionary}
          lng={+mapClickCoordinates.lng.toFixed(4)}
          lat={+mapClickCoordinates.lat.toFixed(4)}
          on:update={addCoordinates}
          on:close={() => (mapClickCoordinates = null)} />
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
                    on:close={toggle} />
                {/if}
              </ShowHide>
            </Popup>
            <NavigationControl />
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
                  on:close={toggle} />
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
        {t ? $t('create.secondary_coordinates') : 'Secondary Coordinates'}
      {:else}
        {t ? $t('create.select_coordinates') : 'Select Coordinates'}
      {/if}
    </Button>
    {#if show}
      <CoordinatesModal {t} lng={null} lat={null} on:update={addCoordinates} on:close={toggle} />
    {/if}
  </ShowHide>

  {#if hasCoordinates}
    <ShowHide let:show let:toggle>
      <Button onclick={toggle} color="black" size="sm">
        <span class="i-mdi-map-marker-path mr-1" style="margin-top: -2px;" />
        {t ? $t('create.select_region') : 'Select Region'}
      </Button>
      {#if show}
        <RegionModal
          {t}
          region={null}
          on:update={({ detail }) => {
            const regions = (dictionary.regions && [...dictionary.regions, detail]) || [detail];
            dispatch('updateRegions', regions);
          }}
          on:close={toggle} />
      {/if}
    </ShowHide>
  {/if}
</div>
