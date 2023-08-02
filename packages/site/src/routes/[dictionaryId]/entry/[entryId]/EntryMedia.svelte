<script lang="ts">
  import { t } from 'svelte-i18n';
  import { ShowHide } from 'svelte-pieces';
  import type { IEntry } from '@living-dictionaries/types';
  import AddImage from '../../entries/AddImage.svelte';
  import Image from '$lib/components/image/Image.svelte';
  import Video from '../../entries/Video.svelte';
  import GeoTaggingModal from './GeoTaggingModal.svelte';
  import { MapboxStatic } from '@living-dictionaries/parts'

  export let entry: IEntry;
  export let videoAccess = false;
  export let canEdit = false;

  $: video = entry.senses?.[0].video_files?.[0];
</script>

<ShowHide let:show let:toggle let:set>
  {#if entry.coordinates}
    <div class="rounded overflow-hidden cursor-pointer" on:click={() => set(canEdit)}>
      <MapboxStatic points={entry.coordinates.points} regions={entry.coordinates.regions} />
    </div>
  {:else if canEdit}
    <button
      on:click={toggle}
      type="button"
      class="rounded bg-gray-100 border-r-2 hover:bg-gray-300 flex flex-col items-center
        justify-center cursor-pointer p-6 mb-2">
      <span class="i-mdi-map-marker-plus mr-1" style="margin-top: -3px;" />
      <span class="text-xs">
        {$t('create.select_coordinates', { default: 'Select Coordinates' })}
      </span>
    </button>
  {/if}
  {#if show}
    <GeoTaggingModal coordinates={entry.coordinates} on:close={toggle} on:valueupdate />
  {/if}
</ShowHide>

{#if video}
  <div class="w-full overflow-hidden rounded relative mb-2">
    <Video class="bg-gray-100 border-r-2" {entry} {video} {canEdit} on:deleteVideo />
  </div>
{:else if videoAccess && canEdit}
  <ShowHide let:show let:toggle>
    <button
      type="button"
      class="rounded bg-gray-100 border-r-2 hover:bg-gray-300 flex flex-col items-center
        justify-center cursor-pointer p-6 mb-2"
      on:click={toggle}>
      <i class="far fa-video-plus my-1 mx-2" />
      <span class="text-xs">
        {$t('video.add_video', { default: 'Add Video' })}
      </span>
    </button>
    {#if show}
      {#await import('$lib/components/video/AddVideo.svelte') then { default: AddVideo }}
        <AddVideo {entry} on:close={toggle} />
      {/await}
    {/if}
  </ShowHide>
{/if}

{#if entry.pf}
  <div class="w-full overflow-hidden rounded relative mb-2" style="height: 25vh;">
    <Image width={400} title={entry.lx} gcs={entry.pf.gcs} {canEdit} on:deleteImage />
  </div>
{:else if canEdit}
  <AddImage {entry} class="rounded-md h-20 bg-gray-100 mb-2">
    <div class="text-xs" slot="text">
      {$t('entry.upload_photo', { default: 'Upload Photo' })}
    </div>
  </AddImage>
{/if}

{#if entry.sf || canEdit}
  {#await import('../../entries/Audio.svelte') then { default: Audio }}
    <Audio {entry} {canEdit} class="h-20 mb-2 rounded-md bg-gray-100 !px-3" />
  {/await}
{/if}
