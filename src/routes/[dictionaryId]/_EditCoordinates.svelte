<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { IDictionary } from '$lib/interfaces';
  import { updateOnline } from '$sveltefirets';
  import { GeoPoint } from 'firebase/firestore/lite';
  import Button from '$svelteui/ui/Button.svelte';

  export let dictionary: IDictionary;
  let lat = dictionary.coordinates ? dictionary.coordinates.latitude : null;
  let lng = dictionary.coordinates ? dictionary.coordinates.longitude : null;
  let modal: 'coordinates' = null;

  $: console.log('dic', dictionary);

  async function save() {
    try {
      await updateOnline(`dictionaries/${dictionary.id}`, { coordinates: new GeoPoint(lat, lng) });
    } catch (err) {
      alert(`${$_('misc.error', { default: 'Error' })}: ${err}`);
    }
  }

  async function showCoordinatesComponent() {
    // @ts-ignore
    dictionary.coordinates = { latitude: lat, longitude: lng };
    modal = 'coordinates';
  }
</script>

<form class="mt-4" on:submit|preventDefault={save}>
  <div class="mt-6">
    <!-- svelte-ignore a11y-label-has-associated-control -->
    <label class="block text-sm font-medium leading-5 text-gray-700">
      {$_('create.where_spoken', {
        default: 'Where is this language spoken?',
      })}*
    </label>
  </div>
  <div class="mt-1">
    <Button onclick={() => showCoordinatesComponent()}>
      {#if lat && lng}
        {lat}°
        {lat < 0 ? 'S' : 'N'},
        {lng}°
        {lng < 0 ? 'W' : 'E'}
      {:else}
        <i class="fas fa-globe-americas mr-1" />
        {$_('create.select_coordinates', { default: 'Select Coordinates' })}
      {/if}
    </Button>
  </div>
</form>

{#if modal === 'coordinates'}
  {#await import('$lib/components/modals/Coordinates.svelte') then { default: Coordinates }}
    <Coordinates
      on:close={() => {
        modal = null;
      }}
      on:save={(event) => {
        (lat = event.detail.lat), (lng = event.detail.lng);
        save();
      }}
      on:remove={() => {
        (lat = lat), (lng = lng);
      }}
      {dictionary} />
  {/await}
{/if}
