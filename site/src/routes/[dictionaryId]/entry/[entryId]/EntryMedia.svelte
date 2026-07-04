<script lang="ts">
  import type { EntryData, Tables } from '$lib/types'
  import Video from '../../entries/components/Video.svelte'
  import GeoTaggingModal from './GeoTaggingModal.svelte'
  import InitableShowHide from './InitableShowHide.svelte'
  import ShowHide from '$lib/components/ui/ShowHide.svelte'
  import MapboxStatic from '$lib/components/maps/mapbox/static/MapboxStatic.svelte'
  import Image from '$lib/components/image/Image.svelte'
  import { get_headword } from '$lib/helpers/orthographies'
  import { page } from '$app/state'
  import type { DbOperations } from '$lib/dbOperations'
  import IconIcOutlineCloudUpload from '~icons/ic/outline-cloud-upload'
  import IconIcOutlineCameraAlt from '~icons/ic/outline-camera-alt'
  import IconBiCameraVideo from '~icons/bi/camera-video'
  import IconMdiMapMarkerPlus from '~icons/mdi/map-marker-plus'
  import IconMdiMapMarkerPath from '~icons/mdi/map-marker-path'

  interface Props {
    entry: EntryData
    dictionary: Tables<'dictionaries'>
    can_edit?: boolean
    dbOperations: DbOperations
  }

  const {
    entry,
    dictionary,
    can_edit = false,
    dbOperations,
  }: Props = $props()

  const photos = $derived(entry?.senses?.map(({ photos }) => photos).filter(Boolean).flat())
  const videos = $derived(entry?.senses?.map(({ videos }) => videos).filter(Boolean).flat())
  const headword = $derived(get_headword({ lexeme: entry.main.lexeme, orthographies: dictionary.orthographies }))

  // Coordinates persist straight to the live `dict_db` entries row (auto-stamps
  // editor + dirty); the Orama watcher reflects it back into the read-model.
  const dict_db = $derived(page.data.dict_db)
</script>

<div class="media-col">
  {#if entry.audios?.length > 0 || can_edit}
    {#await import('../../entries/components/Audio.svelte') then { default: Audio }}
      {#if entry.audios?.length > 0}
        {#each entry.audios as sound_file (sound_file.id)}
          <Audio {entry} {sound_file} {can_edit} context="entry" class="entry-audio-tile" />
        {/each}
      {/if}
      <Audio {entry} {can_edit} context="entry" class="entry-audio-tile" />
    {/await}
  {/if}
  {#each photos as photo (photo.id)}
    <div
      class="photo-frame"
      style="height: 25vh;">
      <Image
        width={400}
        title={headword.value}
        gcs={photo.serving_url}
        photo_source={photo.source}
        photographer={photo.photographer}
        {can_edit}
        on_delete_image={async () => await dbOperations.delete_photo(photo.id)} />
    </div>
  {/each}
  {#if can_edit}
    <ShowHide>
      {#snippet children({ show, toggle })}
        <div class="photo-upload-tile" onclick={toggle}>
          <div class="photo-upload-inner">
            <span class="desktop-only">
              <IconIcOutlineCloudUpload class="icon-inline" style="font-size: 1.5rem" />
            </span>
            <span class="mobile-only">
              <IconIcOutlineCameraAlt class="icon-inline" style="font-size: 1.25rem" />
            </span>
            <div class="tile-label">
              {page.data.t('entry_field.photo')}
            </div>
          </div>
          {#if show}
            {#await import('$lib/components/image/EditImage.svelte') then { default: EditImage }}
              <EditImage on_close={toggle} sense_id={entry.senses[0].id} />
            {/await}
          {/if}
        </div>
      {/snippet}
    </ShowHide>
  {/if}

  {#each videos as video (video.id)}
    <div class="video-frame">
      <Video
        class="entry-video-tile"
        lexeme={headword.value}
        {video}
        {can_edit} />
    </div>
  {/each}
  {#if can_edit}
    <ShowHide>
      {#snippet children({ show, toggle })}
        <button
          type="button"
          class="add-tile"
          onclick={toggle}>
          <IconBiCameraVideo class="icon-inline" style="font-size: 1.25rem" />
          <span class="tile-label">
            {page.data.t('video.add_video')}
          </span>
        </button>
        {#if show}
          {#await import('$lib/components/video/AddVideo.svelte') then { default: AddVideo }}
            <AddVideo {entry} on_close={toggle} />
          {/await}
        {/if}
      {/snippet}
    </ShowHide>
  {/if}

  <InitableShowHide>
    {#snippet children({ show, toggle, set })}
      {#if entry?.main.coordinates?.points?.length || entry?.main.coordinates?.regions?.length}
        <div
          class="map-frame"
          onclick={() => set(can_edit)}>
          <MapboxStatic
            points={entry.main.coordinates.points}
            regions={entry.main.coordinates.regions} />
        </div>
      {:else if can_edit}
        <button
          onclick={() => set('point')}
          type="button"
          class="add-tile">
          <IconMdiMapMarkerPlus class="icon-inline" style="margin-right: 0.25rem; margin-top: -3px;" />
          <span class="tile-label">
            {page.data.t('create.select_coordinates')}
          </span>
        </button>
        <button
          onclick={() => set('region')}
          type="button"
          class="add-tile">
          <IconMdiMapMarkerPath class="icon-inline" style="margin-right: 0.25rem; margin-top: -2px;" />
          <span class="tile-label">
            {page.data.t('create.select_region')}
          </span>
        </button>
      {/if}
      {#if show}
        <GeoTaggingModal
          addPoint={show === 'point'}
          addRegion={show === 'region'}
          coordinates={entry.main.coordinates}
          initialCenter={dictionary.coordinates?.points?.[0]?.coordinates}
          on_close={toggle}
          on_update={async new_value => await dict_db?.entries.update({ id: entry.id, coordinates: new_value })} />
      {/if}
    {/snippet}
  </InitableShowHide>
</div>

<style>
  .media-col {
    display: flex;
    flex-direction: column;
  }

  .media-col :global(.entry-audio-tile) {
    height: 5rem;
    margin-bottom: 0.5rem;
    border-radius: 0.375rem;
    background-color: var(--surface); /* ≈ gray-100 */
    padding-left: 0.75rem !important;
    padding-right: 0.75rem !important;
  }

  .photo-frame {
    width: 100%;
    overflow: hidden;
    border-radius: 0.25rem;
    position: relative;
    margin-bottom: 0.5rem;
  }

  .photo-upload-tile {
    height: 5rem;
    background-color: var(--surface); /* ≈ gray-100 */
    margin-bottom: 0.5rem;
    display: flex;
    flex-direction: column;
  }

  .photo-upload-tile:hover {
    background-color: color-mix(in srgb, var(--background), var(--color) 18%); /* ≈ gray-300 */
  }

  .photo-upload-inner {
    color: color-mix(in srgb, var(--color) 75%, var(--background)); /* ≈ gray-600 */
    height: 100%;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .desktop-only {
    display: none;
  }

  @media (min-width: 768px) {
    .desktop-only {
      display: inline;
    }

    .mobile-only {
      display: none;
    }
  }

  .tile-label {
    font-size: 0.75rem;
    line-height: 1rem;
  }

  .video-frame {
    width: 100%;
    overflow: hidden;
    border-radius: 0.25rem;
    position: relative;
    margin-bottom: 0.5rem;
  }

  .media-col :global(.entry-video-tile) {
    background-color: var(--surface); /* ≈ gray-100 */
    padding: 0.75rem;
    border-right-width: 2px;
  }

  .add-tile {
    border-radius: 0.25rem;
    background-color: var(--surface); /* ≈ gray-100 */
    border-right-width: 2px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 1.5rem;
    margin-bottom: 0.5rem;
  }

  .add-tile:hover {
    background-color: color-mix(in srgb, var(--background), var(--color) 18%); /* ≈ gray-300 */
  }

  .map-frame {
    border-radius: 0.25rem;
    overflow: hidden;
    cursor: pointer;
  }
</style>
