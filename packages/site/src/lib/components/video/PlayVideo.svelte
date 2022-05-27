<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { IEntry, IVideo } from '@living-dictionaries/types';
  import { firebaseConfig } from '$sveltefirets';
  import VideoIFrame from './VideoIFrame.svelte';
  // import { crossfade, scale } from 'svelte/transition';
  import { deleteVideo } from '$lib/helpers/delete';
  import DeleteButton from '../media/DeleteButton.svelte';

  export let entry: IEntry,
    video: IVideo,
    canEdit = false;
</script>

<div
  on:click={() => {
    console.log('close');
  }}
  class="fixed inset-0 md:p-3 flex flex-col items-center justify-center"
  style="background: rgba(0, 0, 0, 0.85); z-index: 51; will-change: transform;">
  <div class="h-full flex flex-col justify-center">
    <div
      class="font-semibold text-white p-4 flex justify-between items-center
          absolute top-0 inset-x-0 bg-opacity-25 bg-black">
      <span on:click|stopPropagation>{entry.lx}</span>
      <i class="far fa-times p-3 cursor-pointer" />
    </div>
    {#if video}
      {#if !video.youtubeId && !video.vimeoId}
        <video
          controls
          autoplay
          playsinline
          src={`https://firebasestorage.googleapis.com/v0/b/${
            firebaseConfig.storageBucket
          }/o/${video.path.replace(/\//g, '%2F')}?alt=media`}>
          <track kind="captions" />
        </video>
      {:else}
        <VideoIFrame {video} />
      {/if}
    {/if}
    <!-- <img class="object-contain max-h-full" alt="Image of {entry.lx}" {src} /> -->
    {#if canEdit}
      <DeleteButton action={() => deleteVideo(entry, video)} />
    {/if}
  </div>
</div>

<!-- <Button onclick={() => deleteVideo(entry, video)} color="red">
  <i class="far fa-trash-alt" />&nbsp;
  <span class="hidden sm:inline"
    >{$_('misc.delete', {
      default: 'Delete',
    })}</span>
</Button> -->

<!-- {#if !video.youtubeId && !video.vimeoId}
        <Button
          href={`https://firebasestorage.googleapis.com/v0/b/${
            firebaseConfig.storageBucket
          }/o/${video.path.replace(/\//g, '%2F')}?alt=media`}
          target="_blank">
          <i class="fas fa-download" />
          <span class="hidden sm:inline"
            >{$_('misc.download', {
              default: 'Download',
            })}</span>
        </Button>
      {/if} -->
