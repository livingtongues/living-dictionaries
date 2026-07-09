<script lang="ts">
  import { onMount } from 'svelte'
  import type { LngLatFull } from '$lib/types'
  import Map from './mapbox/map/Map.svelte'
  import Geocoder from './mapbox/geocoder/Geocoder.svelte'
  import Marker from './mapbox/map/Marker.svelte'
  import ToggleStyle from './mapbox/controls/ToggleStyle.svelte'
  import NavigationControl from './mapbox/controls/NavigationControl.svelte'
  import { set_marker } from './utils/set-coordinates-to-marker'
  import Button from '$lib/components/ui/Button.svelte'
  import Modal from '$lib/components/ui/Modal.svelte'
  import { page } from '$app/state'

  interface Props {
    initialCenter?: LngLatFull
    lng?: number
    lat?: number
    canRemove?: boolean
    on_update: (coordinates: { lat: number, lng: number }) => void
    on_remove?: () => void
    on_close: () => void
    children?: import('svelte').Snippet
  }

  let {
    initialCenter = undefined,
    lng = $bindable(undefined),
    lat = $bindable(undefined),
    canRemove = true,
    on_update,
    on_remove,
    on_close,
    children,
  }: Props = $props()

  let centerLng = $state(lng)
  let centerLat = $state(lat)

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

  function handleGeocoderResult(result) {
    if (result?.user_coordinates?.[0])
      set_marker(result.user_coordinates[0], result.user_coordinates[1])
    else
      set_marker(result.center[0], result.center[1])
  }

  function update() {
    on_update({ lat, lng })
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
      {page.data.t('create.select_coordinates')}
    </span>
  {/snippet}
  <form onsubmit={(e) => { e.preventDefault(); update() }}>
    <div style="display: flex; flex-wrap: wrap; align-items: center; margin-bottom: 0.5rem">
      <div style="display: flex; flex-grow: 1">
        <div style="position: relative">
          <div class="coord-prefix">
            Lat
          </div>
          <input
            type="number"
            step=".0001"
            required
            max="90"
            min="-90"
            bind:value={lat}
            class="lat-input"
            placeholder={page.data.t('dictionary.latitude')} />
        </div>
        <div style="width: 0.25rem"></div>

        <div style="position: relative">
          <div class="coord-prefix">
            Lng
          </div>
          <input
            type="number"
            step=".0001"
            required
            max="180"
            min="-180"
            bind:value={lng}
            class="lng-input"
            placeholder={page.data.t('dictionary.longitude')} />
        </div>
      </div>
    </div>

    <div style="height: 50vh;">
      <Map
        lng={centerLng}
        lat={centerLat}
        {zoom}
        on_click={lng_lat => ({ lng, lat } = set_marker(lng_lat.lng, lng_lat.lat))}>
        {@render children?.()}
        <NavigationControl />
        <Geocoder
          options={{ marker: false }}
          placeholder={page.data.t('about.search')}
          on_result={handleGeocoderResult}
          on_error={error => console.error(error)} />
        {#if lng !== undefined && lat !== undefined}
          <Marker
            draggable
            on_dragend={coordinates => ({ lng, lat } = set_marker(coordinates.lng, coordinates.lat))}
            {lng}
            {lat} />
        {/if}
        <ToggleStyle />
      </Map>
    </div>

    <div class="modal-footer">
      <Button onclick={on_close} form="simple" color="black">
        {page.data.t('misc.cancel')}
      </Button>
      {#if canRemove}
        <Button onclick={remove} form="simple" color="red">
          {page.data.t('misc.remove')}
        </Button>
      {/if}
      <Button type="submit" form="filled">
        {page.data.t('misc.save')}
      </Button>
    </div>
  </form>
</Modal>

<style>
  .coord-prefix {
    position: absolute;
    top: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    font-size: 0.875rem;
    line-height: 1.25rem;
    color: var(--color-secondary); /* ≈ gray-500 */
    text-transform: uppercase;
    left: 0;
    padding-left: 0.5rem;
    pointer-events: none;
  }

  .lat-input,
  .lng-input {
    width: 8rem;
    padding: 0.5rem 0.75rem 0.5rem 2.5rem;
  }

  @media (min-width: 768px) {
    .lng-input {
      width: 9rem;
    }
  }
</style>
