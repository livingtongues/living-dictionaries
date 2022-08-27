<script lang="ts">
  import type { Readable } from 'svelte/store';
  export let t: Readable<any> = undefined;

  import Button from 'svelte-pieces/ui/Button.svelte';
  import ShowHide from 'svelte-pieces/functions/ShowHide.svelte';
  import LatLngDisplay from '../maps/LatLngDisplay.svelte';
  export let lng: number, lat: number;
</script>

<div class="text-sm font-medium text-gray-700">
  {t ? $t('create.where_spoken') : 'Where is this language spoken?'}*
</div>
{#if lat && lng}
  <div class="mt-1">
    <ShowHide let:show let:toggle>
      <Button onclick={toggle}>
        <span class="i-ic-sharp-star mr-1" />
        <LatLngDisplay {lat} {lng} />
      </Button>
      {#if show}
        {#await import('../maps/CoordinatesModal.svelte') then { default: CoordinatesModal }}
          <CoordinatesModal {t} {lng} {lat} on:update on:remove on:close={toggle} />
        {/await}
      {/if}
    </ShowHide>
  </div>
  <div class="mt-1">
    <ShowHide let:show let:toggle>
      <Button onclick={toggle}>
        <span class="i-mdi-map-marker-path mr-1" />
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
    <Button onclick={toggle}>
      <span class="i-mdi-map-marker-plus mr-1" />
      {t ? $t('create.select_coordinates') : 'Select Coordinates'}
    </Button>
    {#if show}
      {#await import('../maps/CoordinatesModal.svelte') then { default: CoordinatesModal }}
        <CoordinatesModal {t} {lng} {lat} on:update on:remove on:close={toggle} />
      {/await}
    {/if}
  </ShowHide>
</div>
