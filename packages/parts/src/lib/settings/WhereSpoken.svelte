<script lang="ts">
  import type { Readable } from 'svelte/store';
  export let t: Readable<any> = undefined;

  import Button from 'svelte-pieces/ui/Button.svelte';
  import ShowHide from 'svelte-pieces/functions/ShowHide.svelte';
  import type { IDictionary, IPoint, IRegion } from '@living-dictionaries/types';
  import Map from '../maps/mapbox/map/Map.svelte';
  import Marker from '../maps/mapbox/map/Marker.svelte';
  import Popup from '../maps/mapbox/map/Popup.svelte';
  import Region from '../maps/mapbox/map/Region.svelte';
  import CoordinatesModal from '../maps/CoordinatesModal.svelte';
  import RegionModal from '../maps/RegionModal.svelte';

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{
    updateCoordinates: { longitude: number; latitude: number };
    removeCoordinates: boolean;
    updatePoints: IPoint[];
    updateRegions: IRegion[];
  }>();

  export let dictionary: Partial<IDictionary>;
</script>

<div class="text-sm font-medium text-gray-700 mb-2">
  {t ? $t('create.where_spoken') : 'Where is this language spoken?'}*
</div>

{#if dictionary.coordinates}
  <div class="h-240px">
    <Map lng={dictionary.coordinates.longitude} lat={dictionary.coordinates.latitude}>
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
                        type: 'point',
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
      color={dictionary.coordinates ? 'black' : 'primary'}
      size={dictionary.coordinates ? 'sm' : 'md'}>
      <span class="i-mdi-map-marker-plus mr-1" style="margin-top: -3px;" />
      {t ? $t('create.select_coordinates') : 'Select Coordinates'}
    </Button>
    {#if show}
      <CoordinatesModal
        {t}
        lng={null}
        lat={null}
        on:update={({ detail }) => {
          if (dictionary.coordinates) {
            const point = {
              type: 'point',
              coordinates: { longitude: detail.lng, latitude: detail.lat },
            };
            const points = (dictionary.points && [...dictionary.points, point]) || [point];
            //@ts-ignore
            dispatch('updatePoints', points);
          } else {
            dispatch('updateCoordinates', { longitude: detail.lng, latitude: detail.lat });
          }
        }}
        on:close={toggle} />
    {/if}
  </ShowHide>

  {#if dictionary.coordinates}
    <ShowHide let:show let:toggle>
      <Button onclick={toggle} color="black" size="sm">
        <span class="i-mdi-map-marker-path mr-1" style="margin-top: -2px;" />
        Select Region
        <!-- {t ? $t('create.select_region') : 'Select Region'} -->
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
