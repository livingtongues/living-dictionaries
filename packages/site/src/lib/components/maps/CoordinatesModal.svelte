<script lang="ts">
  import type { LngLatFull } from '@living-dictionaries/types/coordinates.interface'
  import { page } from '$app/stores'
  import { Button, Modal } from '$lib/svelte-pieces'
  import { onMount } from 'svelte'
  import NavigationControl from './mapbox/controls/NavigationControl.svelte'
  import ToggleStyle from './mapbox/controls/ToggleStyle.svelte'
  import Geocoder from './mapbox/geocoder/Geocoder.svelte'
  import Map from './mapbox/map/Map.svelte'
  import Marker from './mapbox/map/Marker.svelte'
  import { setMarker } from './utils/setCoordinatesToMarker'

  interface Props {
    initialCenter?: LngLatFull
    lng?: number
    lat?: number
    canRemove?: boolean
    on_update?: (detail: { lat: number, lng: number }) => void
    on_remove?: () => void
    on_close: () => void
  }

  let {
    initialCenter = undefined,
    lng = $bindable(undefined),
    lat = $bindable(undefined),
    canRemove = true,
    on_update = undefined,
    on_remove = undefined,
    on_close,
  }: Props = $props()

  let centerLng = lng
  let centerLat = lat

  const zoom = lng && lat ? 6 : 3

  onMount(() => {
    if (lng && lat) return
    if (initialCenter) {
      ({ longitude: centerLng, latitude: centerLat } = initialCenter)
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        centerLng = position.coords.longitude
        centerLat = position.coords.latitude
      })
    }
  })

  function handleGeocoderResult({ detail }) {
    if (detail?.user_coordinates?.[0])
      setMarker(detail.user_coordinates[0], detail.user_coordinates[1])
    else
      setMarker(detail.center[0], detail.center[1])
  }

  function update() {
    on_update?.({ lat, lng })
    on_close()
  }
  function remove() {
    on_remove?.()
    on_close()
  }
</script>

<Modal {on_close} noscroll>
  {#snippet heading()}
    <span>
      {$page.data.t('create.select_coordinates')}
    </span>
  {/snippet}
  <form on:submit|preventDefault={update}>
    <div class="flex flex-wrap items-center mb-2">
      <div class="flex flex-grow">
        <div class="relative">
          <div
            class="absolute inset-y-0 flex items-center text-sm text-gray-500
              uppercase left-0 pl-2 pointer-events-none">
            Lat
          </div>
          <input
            type="number"
            step=".0001"
            required
            max="90"
            min="-90"
            bind:value={lat}
            class="w-32 pl-10 pr-3 py-2 form-input"
            placeholder={$page.data.t('dictionary.latitude')} />
        </div>
        <div class="w-1" />

        <div class="relative">
          <div
            class="absolute inset-y-0 flex items-center text-sm text-gray-500
              uppercase left-0 pl-2 pointer-events-none">
            Lng
          </div>
          <input
            type="number"
            step=".0001"
            required
            max="180"
            min="-180"
            bind:value={lng}
            class="w-32 md:w-36 pl-10 pr-3 py-2 form-input"
            placeholder={$page.data.t('dictionary.longitude')} />
        </div>
      </div>
    </div>

    <div style="height: 50vh;">
      <Map
        lng={centerLng}
        lat={centerLat}
        {zoom}
        on:click={({ detail }) => ({ lng, lat } = setMarker(detail.lng, detail.lat))}>
        <slot />
        <NavigationControl />
        <Geocoder
          options={{ marker: false }}
          placeholder={$page.data.t('about.search')}
          on:result={handleGeocoderResult}
          on:error={e => console.error(e.detail)} />
        {#if lng && lat}
          <Marker
            draggable
            on:dragend={({ detail }) => ({ lng, lat } = setMarker(detail.lng, detail.lat))}
            {lng}
            {lat} />
        {/if}
        <ToggleStyle />
      </Map>
    </div>

    <div class="modal-footer">
      <Button onclick={on_close} form="simple" color="black">
        {$page.data.t('misc.cancel')}
      </Button>
      {#if canRemove}
        <Button onclick={remove} form="simple" color="red">
          {$page.data.t('misc.remove')}
        </Button>
      {/if}
      <Button type="submit" form="filled">
        {$page.data.t('misc.save')}
      </Button>
    </div>
  </form>
</Modal>
