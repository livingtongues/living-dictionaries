<script lang="ts">
  import type { Readable } from 'svelte/store';
  export let t: Readable<any> = undefined;

  import Button from 'svelte-pieces/ui/Button.svelte';
  import ShowHide from 'svelte-pieces/functions/ShowHide.svelte';
  import LatLngDisplay from '../maps/LatLngDisplay.svelte';
  import type { IArea, IDictionary } from '@living-dictionaries/types';
  import MapboxStatic from '$lib/maps/mapbox/static/MapboxStatic.svelte';
  export let dictionary: IDictionary;

  let areas: IArea[] = [];
  $: areas = (() => {
    const a = [];
    if (dictionary.coordinates) {
      a.push({
        type: 'point',
        coordinates: {
          longitude: dictionary.coordinates.longitude,
          latitude: dictionary.coordinates.latitude,
        },
      });
    }
    if (dictionary.points) {
      a.push(...dictionary.points);
    }
    if (dictionary.regions) {
      a.push(...dictionary.regions);
    }
    console.log(a);
    return a;
  })();
</script>

<div class="text-sm font-medium text-gray-700 mb-2">
  {t ? $t('create.where_spoken') : 'Where is this language spoken?'}*
</div>
{#if dictionary.coordinates}
  <MapboxStatic {areas} />

  <div class="mt-1">
    <ShowHide let:show let:toggle>
      <Button onclick={toggle}>
        <span class="i-ic-sharp-star mr-1" style="margin-top: -3px" />
        <LatLngDisplay
          lng={dictionary.coordinates.longitude}
          lat={dictionary.coordinates.latitude} />
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
  </div>
  <div class="mt-1">
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
      {#await import('../maps/CoordinatesModal.svelte') then { default: CoordinatesModal }}
        <CoordinatesModal {t} lng={null} lat={null} on:update on:remove on:close={toggle} />
      {/await}
    {/if}
  </ShowHide>
</div>
