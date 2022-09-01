<script lang="ts">
  import type { Readable } from 'svelte/store';
  export let t: Readable<any> = undefined;

  import Button from 'svelte-pieces/ui/Button.svelte';
  import ShowHide from 'svelte-pieces/functions/ShowHide.svelte';
  import type { IDictionary } from '@living-dictionaries/types';
  import Map from '$lib/maps/mapbox/map/Map.svelte';
  import Marker from '$lib/maps/mapbox/map/Marker.svelte';
  import Popup from '$lib/maps/mapbox/map/Popup.svelte';
  import Region from '$lib/maps/mapbox/map/Region.svelte';
  export let dictionary: IDictionary;
</script>

<div class="text-sm font-medium text-gray-700 mb-2">
  {t ? $t('create.where_spoken') : 'Where is this language spoken?'}*
</div>

<div class="h-200px">
  <Map lng={dictionary.coordinates?.longitude} lat={dictionary.coordinates?.latitude}>
    {#if dictionary.coordinates}
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
              {#await import('../maps/CoordinatesModal.svelte') then { default: CoordinatesModal }}
                <CoordinatesModal
                  {t}
                  lng={dictionary.coordinates.longitude}
                  lat={dictionary.coordinates.latitude}
                  on:update
                  on:remove
                  on:close={toggle} />
              {/await}
            {/if}
          </ShowHide>
        </Popup>
      </Marker>
    {/if}

    {#if dictionary.points}
      {#each dictionary.points as point}
        <Marker lat={point.coordinates.latitude} lng={point.coordinates.longitude}>
          <Popup>
            <ShowHide let:show let:toggle>
              <Button form="simple" size="sm" onclick={toggle}>
                <span class="i-octicon-pencil" />
              </Button>
              {#if show}
                {#await import('../maps/CoordinatesModal.svelte') then { default: CoordinatesModal }}
                  <CoordinatesModal
                    {t}
                    lng={point.coordinates.longitude}
                    lat={point.coordinates.latitude}
                    on:update
                    on:remove
                    on:close={toggle} />
                {/await}
              {/if}
            </ShowHide>
          </Popup>
        </Marker>
      {/each}
    {/if}
    {#if dictionary.regions}
      {#each dictionary.regions as region}
        <Region {region} />
      {/each}
    {/if}
  </Map>
</div>

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
      {#await import('../maps/CoordinatesModal.svelte') then { default: CoordinatesModal }}
        <CoordinatesModal {t} lng={null} lat={null} on:update on:remove on:close={toggle} />
      {/await}
    {/if}
  </ShowHide>

  {#if dictionary.coordinates}
    <ShowHide let:show let:toggle>
      <Button onclick={toggle} color="black" size="sm">
        <span class="i-mdi-map-marker-path mr-1" style="margin-top: -2px;" />
        {t ? $t('create.select_region') : 'Select Region'}
      </Button>
      {#if show}
        {#await import('../maps/RegionModal.svelte') then { default: RegionModal }}
          <RegionModal {t} region={null} on:update on:remove on:close={toggle} />
        {/await}
      {/if}
    </ShowHide>
  {/if}
</div>
