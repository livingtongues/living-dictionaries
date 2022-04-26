<script lang="ts">
  import type { Readable } from 'svelte/store';
  export let t: Readable<any> = undefined;

  import Button from 'svelte-pieces/ui/Button.svelte';
  import ShowHide from 'svelte-pieces/functions/ShowHide.svelte';
  import LatLngDisplay from '../maps/LatLngDisplay.svelte';
  export let lng: number, lat: number;
</script>

<div class="block text-sm font-medium leading-5 text-gray-700">
  {t ? $t('create.where_spoken') : 'Where is this language spoken?'}*
</div>
<div class="mt-1">
  <ShowHide let:show let:toggle>
    <Button onclick={toggle}>
      {#if lat && lng}
        <LatLngDisplay {lat} {lng} />
      {:else}
        <span class="i-fa-solid-globe-americas mr-1" />
        {t ? $t('create.select_coordinates') : 'Select Coordinates'}
      {/if}
    </Button>
    {#if show}
      {#await import('../maps/CoordinatesModal.svelte') then { default: CoordinatesModal }}
        <CoordinatesModal {t} {lng} {lat} on:update on:remove on:close={toggle} />
      {/await}
    {/if}
  </ShowHide>
</div>
