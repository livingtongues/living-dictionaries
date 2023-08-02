<script lang="ts">
  import { t } from 'svelte-i18n';
  import { ShowHide } from 'svelte-pieces';
  import type { ExpandedEntry } from '@living-dictionaries/types';
  import AddImage from '../../entries/AddImage.svelte';
  import Image from '$lib/components/image/Image.svelte';
  import Video from '../../entries/Video.svelte';

  export let entry: ExpandedEntry;
  export let dictionaryId: string;
  export let videoAccess = false;
  export let canEdit = false;

  $: first_sound_file = entry.sound_files?.[0];
  $: first_photo = entry.senses?.[0].photo_files?.[0];
  $: first_video = entry.senses?.[0].video_files?.[0];
</script>

{#if first_sound_file || canEdit}
  {#await import('../../entries/Audio.svelte') then { default: Audio }}
    <Audio {entry} {canEdit} class="h-20 mb-2 rounded-md bg-gray-100 !px-3" let:playing>
      <span class:text-blue-700={playing} class="i-material-symbols-hearing text-2xl mt-1" />
      <div class="text-gray-600 text-sm mt-1">
        {$t('audio.listen', { default: 'Listen' })}
        {#if canEdit}
          +
          {$t('audio.edit_audio', { default: 'Edit Audio' })}
        {/if}
      </div>
    </Audio>
  {/await}
{/if}

{#if first_photo}
  <div class="w-full overflow-hidden rounded relative mb-2" style="height: 25vh;">
    <Image width={400} title={entry.lexeme} gcs={first_photo.specifiable_image_url} {canEdit} on:deleteImage />
  </div>
{:else if canEdit}
  <AddImage {dictionaryId} {entry} class="rounded-md h-20 bg-gray-100 mb-2">
    <div class="text-xs" slot="text">
      {$t('entry.upload_photo', { default: 'Upload Photo' })}
    </div>
  </AddImage>
{/if}

{#if first_video}
  <div class="w-full overflow-hidden rounded relative mb-2">
    <Video class="bg-gray-100 border-r-2" {entry} video={first_video} {canEdit} on:deleteVideo />
  </div>
{:else if videoAccess && canEdit}
  <ShowHide let:show let:toggle>
    <button
      type="button"
      class="rounded bg-gray-100 border-r-2 hover:bg-gray-300 flex flex-col items-center
        justify-center cursor-pointer p-6 mb-2"
      on:click={toggle}>
      <span class="i-bi-camera-video text-xl" />
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

