<script lang="ts">
  import type { DictionaryView, IPoint, IRegion } from '$lib/types'
  import type { LngLat } from 'mapbox-gl'
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import { page } from '$app/state'
  import Map from '$lib/components/maps/mapbox/map/Map.svelte'
  import Marker from '$lib/components/maps/mapbox/map/Marker.svelte'
  import Popup from '$lib/components/maps/mapbox/map/Popup.svelte'
  import Region from '$lib/components/maps/mapbox/map/Region.svelte'
  import CoordinatesModal from '$lib/components/maps/CoordinatesModal.svelte'
  import RegionModal from '$lib/components/maps/RegionModal.svelte'
  import NavigationControl from '$lib/components/maps/mapbox/controls/NavigationControl.svelte'
  import IconOcticonPencil from '~icons/octicon/pencil'
  import IconMdiMapMarkerPlus from '~icons/mdi/map-marker-plus'
  import IconMdiMapMarkerPath from '~icons/mdi/map-marker-path'

  interface Props {
    on_update_points: (points: IPoint[]) => void
    on_update_regions: (regions: IRegion[]) => void
    dictionary: Partial<DictionaryView>
    show_title?: boolean
  }

  const { on_update_points, on_update_regions, dictionary, show_title = true }: Props = $props()

  const first_longitude = $derived(dictionary.coordinates?.points?.[0]?.coordinates?.longitude)
  const first_latitude = $derived(dictionary.coordinates?.points?.[0]?.coordinates?.latitude)

  function addCoordinates({ lng, lat }: { lng: number, lat: number }) {
    const point: IPoint = { coordinates: { longitude: lng, latitude: lat } }
    const points = (dictionary.coordinates?.points && [...dictionary.coordinates.points, point]) || [point]
    on_update_points(points)
  }

  let mapClickCoordinates: LngLat = $state()
</script>

{#if show_title}
  <div class="section-title">
    {page.data.t('create.where_spoken')}
  </div>
{/if}

{#if first_longitude !== undefined}
  <div class="hint">
    {page.data.t('create.map_instructions')}
  </div>
  <div style="height: 240px">
    <Map
      lng={first_longitude}
      lat={first_latitude}
      on_click={lng_lat => (mapClickCoordinates = lng_lat)}>
      <NavigationControl />
      {#if mapClickCoordinates}
        <CoordinatesModal
          lng={+mapClickCoordinates.lng.toFixed(4)}
          lat={+mapClickCoordinates.lat.toFixed(4)}
          on_update={addCoordinates}
          on_close={() => (mapClickCoordinates = null)}>
        </CoordinatesModal>
      {/if}

      {#each dictionary.coordinates.points || [] as point, index (point)}
        <Marker
          color={index === 0 ? 'blue' : 'black'}
          lat={point.coordinates.latitude}
          lng={point.coordinates.longitude}>
          <Popup>
            <ShowHide>
              {#snippet children({ show, toggle })}
                <HeadlessButton class="btn-ghost btn-sm" onclick={toggle}>
                  <IconOcticonPencil />
                  {#if index === 0}
                    {page.data.t('create.primary_coordinate')}
                  {/if}
                </HeadlessButton>
                {#if show}
                  <CoordinatesModal
                    lng={point.coordinates.longitude}
                    lat={point.coordinates.latitude}
                    on_update={({ lng, lat }) => {
                      const { points } = dictionary.coordinates
                      points[index] = {
                        coordinates: { longitude: lng, latitude: lat },
                      }
                      on_update_points(points)
                    }}
                    on_remove={() => {
                      const { points } = dictionary.coordinates
                      points.splice(index, 1)
                      on_update_points(points)
                    }}
                    on_close={toggle}>
                  </CoordinatesModal>
                {/if}
              {/snippet}
            </ShowHide>
          </Popup>
        </Marker>
      {/each}

      {#each dictionary.coordinates.regions || [] as region, index (region)}
        <Region {region}>
          <ShowHide>
            {#snippet children({ show, toggle })}
              <HeadlessButton class="btn-ghost btn-sm" onclick={toggle}>
                <IconOcticonPencil />
              </HeadlessButton>
              {#if show}
                <RegionModal
                  {region}
                  on_update={(updated_region) => {
                    const { regions } = dictionary.coordinates
                    regions[index] = updated_region
                    on_update_regions(regions)
                  }}
                  on_remove={() => {
                    const { regions } = dictionary.coordinates
                    regions.splice(index, 1)
                    on_update_regions(regions)
                  }}
                  on_close={toggle}>
                </RegionModal>
              {/if}
            {/snippet}
          </ShowHide>
        </Region>
      {/each}
    </Map>
  </div>
{/if}

<div style="margin-top: 0.25rem">
  <ShowHide>
    {#snippet children({ show, toggle })}
      <HeadlessButton
        onclick={toggle}
        class="btn {first_longitude !== undefined ? 'btn-sm' : 'btn-default'}">
        <IconMdiMapMarkerPlus style="margin-right: 0.25rem; margin-top: -3px;" />
        {page.data.t('create.select_coordinates')}
      </HeadlessButton>
      {#if show}
        <CoordinatesModal
          initialCenter={first_longitude !== undefined ? { longitude: first_longitude, latitude: first_latitude } : undefined}
          on_update={addCoordinates}
          on_close={toggle} />
      {/if}
    {/snippet}
  </ShowHide>

  {#if first_longitude !== undefined}
    <ShowHide>
      {#snippet children({ show, toggle })}
        <HeadlessButton class="btn btn-sm" onclick={toggle}>
          <IconMdiMapMarkerPath style="margin-right: 0.25rem; margin-top: -2px;" />
          {page.data.t('create.select_region')}
        </HeadlessButton>
        {#if show}
          <RegionModal
            initialCenter={{ longitude: first_longitude, latitude: first_latitude }}
            region={null}
            on_update={(new_region) => {
              const regions = (dictionary.coordinates.regions && [...dictionary.coordinates.regions, new_region]) || [new_region]
              on_update_regions(regions)
            }}
            on_close={toggle} />
        {/if}
      {/snippet}
    </ShowHide>
  {/if}
</div>

<style>
  .section-title {
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 500;
    color: color-mix(in srgb, var(--color) 85%, var(--background)); /* ≈ gray-700 */
    margin-bottom: 0.5rem;
  }

  .hint {
    font-size: 0.75rem;
    line-height: 1rem;
    color: color-mix(in srgb, var(--color) 75%, var(--background)); /* ≈ gray-600 */
    margin-bottom: 0.5rem;
  }
</style>
