<script lang="ts">
  import { ShowHide } from 'svelte-pieces'
  import type { EntryView, IDictionary } from '@living-dictionaries/types'
  import Video from '../../entries/components/Video.svelte'
  import GeoTaggingModal from './GeoTaggingModal.svelte'
  import InitableShowHide from './InitableShowHide.svelte'
  import MapboxStatic from '$lib/components/maps/mapbox/static/MapboxStatic.svelte'
  import Image from '$lib/components/image/Image.svelte'
  import { page } from '$app/stores'
  import type { DbOperations } from '$lib/dbOperations'
  import AddImage from '$lib/components/image/AddImage.svelte'

  export let entry: EntryView
  export let dictionary: IDictionary
  export let can_edit = false
  export let dbOperations: DbOperations

  $: ({ photos, videos } = $page.data)

  $: first_sound_file = entry?.audios?.[0]
  $: first_photo_id = entry?.senses?.[0].photo_ids?.[0]
  $: first_photo = (first_photo_id && $photos.length) ? $photos.find(photo => photo.id === first_photo_id) : null
  $: first_video_id = entry?.senses?.[0].video_ids?.[0]
  $: first_video = (first_video_id && $videos.length) ? $videos.find(video => video.id === first_video_id) : null
</script>

<div class="flex flex-col">
  {#if first_sound_file || can_edit}
    {#await import('../../entries/components/Audio.svelte') then { default: Audio }}
      <Audio {entry} {can_edit} context="entry" class="h-20 mb-2 rounded-md bg-gray-100 !px-3" />
    {/await}
  {/if}

  {#if first_photo}
    <div
      class="w-full overflow-hidden rounded relative mb-2"
      style="height: 25vh;">
      <Image
        width={400}
        title={entry.main.lexeme.default}
        gcs={first_photo.serving_url}
        {can_edit}
        on_delete_image={async () => await dbOperations.update_photo({ photo: { deleted: 'true' }, photo_id: first_photo_id })} />
    </div>
  {:else if can_edit}
    <div class="h-20 bg-gray-100 hover:bg-gray-300 mb-2 flex flex-col">
      <AddImage upload_image={file => dbOperations.addImage({ file, sense_id: entry.senses[0].id })}>
        <div class="text-xs">
          {$page.data.t('entry.upload_photo')}
        </div>
      </AddImage>
    </div>
  {/if}

  {#if first_video}
    <div class="w-full overflow-hidden rounded relative mb-2">
      <Video
        class="bg-gray-100 p-3 border-r-2"
        lexeme={entry.main.lexeme.default}
        video={first_video}
        {can_edit} />
    </div>
  {:else if can_edit}
    <ShowHide let:show let:toggle>
      <button
        type="button"
        class="rounded bg-gray-100 border-r-2 hover:bg-gray-300 flex flex-col items-center
          justify-center cursor-pointer p-6 mb-2"
        on:click={toggle}>
        <span class="i-bi-camera-video text-xl" />
        <span class="text-xs">
          {$page.data.t('video.add_video')}
        </span>
      </button>
      {#if show}
        {#await import('$lib/components/video/AddVideo.svelte') then { default: AddVideo }}
          <AddVideo {entry} on_close={toggle} />
        {/await}
      {/if}
    </ShowHide>
  {/if}

  <InitableShowHide let:show let:toggle let:set>
    {#if entry?.main.coordinates?.points?.length || entry?.main.coordinates?.regions?.length}
      <div
        class="rounded overflow-hidden cursor-pointer"
        on:click={() => set(can_edit)}>
        <MapboxStatic
          points={entry.main.coordinates.points}
          regions={entry.main.coordinates.regions} />
      </div>
    {:else if can_edit}
      <button
        on:click={() => set('point')}
        type="button"
        class="rounded bg-gray-100 border-r-2 hover:bg-gray-300 flex flex-col items-center
          justify-center cursor-pointer p-6 mb-2">
        <span class="i-mdi-map-marker-plus mr-1" style="margin-top: -3px;" />
        <span class="text-xs">
          {$page.data.t('create.select_coordinates')}
        </span>
      </button>
      <button
        on:click={() => set('region')}
        type="button"
        class="rounded bg-gray-100 border-r-2 hover:bg-gray-300 flex flex-col items-center
          justify-center cursor-pointer p-6 mb-2">
        <span class="i-mdi-map-marker-path mr-1" style="margin-top: -2px;" />
        <span class="text-xs">
          {$page.data.t('create.select_region')}
        </span>
      </button>
    {/if}
    {#if show}
      <GeoTaggingModal
        addPoint={show === 'point'}
        addRegion={show === 'region'}
        coordinates={entry.main.coordinates}
        initialCenter={dictionary.coordinates}
        on_close={toggle}
        on_update={async new_value => await dbOperations.update_entry({ entry: { coordinates: new_value } })} />
    {/if}
  </InitableShowHide>
</div>
