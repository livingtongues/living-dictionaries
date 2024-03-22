<script lang="ts">
  import { page } from '$app/stores';
  import { ShowHide } from 'svelte-pieces';
  import type { ExpandedEntry, IDictionary } from '@living-dictionaries/types';
  import AddImage from '../../entries/AddImage.svelte';
  import Image from '$lib/components/image/Image.svelte';
  import Video from '../../entries/Video.svelte';
  import GeoTaggingModal from './GeoTaggingModal.svelte';
  import InitableShowHide from './InitableShowHide.svelte';
  import MapboxStatic from '$lib/components/maps/mapbox/static/MapboxStatic.svelte';

  export let entry: ExpandedEntry;
  export let dictionary: IDictionary;
  export let videoAccess = false;
  export let can_edit = false;

  $: first_sound_file = entry.sound_files?.[0];
  $: first_photo = entry.senses?.[0].photo_files?.[0];
  $: first_video = entry.senses?.[0].video_files?.[0];
</script>

<div class="flex flex-col">
  {#if first_sound_file || can_edit}
    {#await import('../../entries/Audio.svelte') then { default: Audio }}
      <Audio {entry} {can_edit} context="entry" class="h-20 mb-2 rounded-md bg-gray-100 !px-3" />
    {/await}
  {/if}

  {#if first_photo}
    <div
      class="w-full overflow-hidden rounded relative mb-2"
      style="height: 25vh;">
      <Image
        width={400}
        title={entry.lexeme}
        gcs={first_photo.specifiable_image_url}
        {can_edit}
        on:deleteImage />
    </div>
  {:else if can_edit}
    <AddImage
      dictionaryId={dictionary.id}
      entryId={entry.id}
      class="rounded-md h-20 bg-gray-100 mb-2">
      <div class="text-xs" slot="text">
        {$page.data.t('entry.upload_photo')}
      </div>
    </AddImage>
  {/if}

  {#if first_video}
    <div class="w-full overflow-hidden rounded relative mb-2">
      <Video
        class="bg-gray-100 p-3 border-r-2"
        lexeme={entry.lexeme}
        video={first_video}
        {can_edit}
        on:deleteVideo />
    </div>
  {:else if videoAccess && can_edit}
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
          <AddVideo {entry} on:close={toggle} />
        {/await}
      {/if}
    </ShowHide>
  {/if}

  <InitableShowHide let:show let:toggle let:set>
    {#if entry.coordinates?.points?.length || entry.coordinates?.regions?.length}
      <div
        class="rounded overflow-hidden cursor-pointer"
        on:click={() => set(can_edit)}>
        <MapboxStatic
          points={entry.coordinates.points}
          regions={entry.coordinates.regions} />
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
        coordinates={entry.coordinates}
        initialCenter={dictionary.coordinates}
        on:close={toggle}
        on:valueupdate />
    {/if}
  </InitableShowHide>
</div>
