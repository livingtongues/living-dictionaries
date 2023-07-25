<script lang="ts">
  import { Modal, Button } from 'svelte-pieces';
  import Map from '@living-dictionaries/parts/src/lib/maps/mapbox/map/Map.svelte';
  import type { Readable } from 'svelte/store';
  import { onMount, createEventDispatcher } from 'svelte';
  export let t: Readable<any> = undefined;

  let centerLng:number;
  let centerLat:number;
  export let canRemove = true;

  onMount(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        centerLng = position.coords.longitude;
        centerLat = position.coords.latitude;
      });
    }
  });

  const dispatch = createEventDispatcher<{
    remove: boolean;
    close: boolean;
  }>();
  function remove() {
    dispatch('remove');
    dispatch('close');
  }
</script>

<Modal on:close noscroll>
  <form on:submit|preventDefault style="height: 50vh;">
    <Map lng={centerLng} lat={centerLat} />
  </form>
  <div class="modal-footer">
    <Button onclick={() => dispatch('close')} form="simple" color="black">
      {t ? $t('misc.cancel') : 'Cancel'}
    </Button>
    {#if canRemove}
      <Button onclick={remove} form="simple" color="red">
        {t ? $t('misc.remove') : 'Remove'}
      </Button>
    {/if}
    <Button type="submit" form="filled">
      {t ? $t('misc.save') : 'Save'}
    </Button>
  </div>
</Modal>
