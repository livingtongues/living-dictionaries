<script lang="ts">
  import { page } from '$app/stores';
  import type { ExpandedVideo } from '@living-dictionaries/types';
  import VideoIFrame from './VideoIFrame.svelte';
  import { Button } from 'svelte-pieces';
  import { createEventDispatcher } from 'svelte';

  export let lexeme: string;
  export let video: ExpandedVideo;
  export let storageBucket: string;
  export let can_edit = false;

  const dispatch = createEventDispatcher<{
    close: boolean;
    deleteVideo: boolean;
  }>();
</script>

<div
  on:click={() => dispatch('close')}
  class="fixed inset-0 md:p-3 flex flex-col items-center justify-center"
  style="background: rgba(0, 0, 0, 0.85); z-index: 51; will-change: transform;">
  <div class="h-full flex flex-col justify-center">
    <div
      class="font-semibold text-white p-4 flex justify-between items-center
        absolute top-0 inset-x-0 bg-opacity-25 bg-black">
      <span on:click|stopPropagation>{lexeme}</span>
      <span class="i-fa-solid-times p-3 cursor-pointer" />
    </div>
    {#if video}
      {#if !video.youtubeId && !video.vimeoId}
        <video
          controls
          autoplay
          playsinline
          src={`https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o/${video.fb_storage_path.replace(
            /\//g,
            '%2F'
          )}?alt=media`}>
          <track kind="captions" />
        </video>
      {:else}
        <VideoIFrame {video} />
      {/if}
    {/if}
    <!-- <img class="object-contain max-h-full" alt="Image of {entry.lx}" {src} /> -->
    {#if can_edit}
      <div
        class="p-4 flex justify-between
          items-center absolute bottom-0 inset-x-0 bg-opacity-25 bg-black">
        <Button
          class="ml-auto"
          color="red"
          form="filled"
          onclick={(e) => {
            e.stopPropagation();
            dispatch('deleteVideo');
          }}>
          <span class="i-fa-trash-o" style="margin: -1px 0 2px;" />
          {$page.data.t('misc.delete')}
        </Button>
      </div>
    {/if}
  </div>
</div>

<!-- {#if !video.youtubeId && !video.vimeoId}
        <Button
          href={`https://firebasestorage.googleapis.com/v0/b/${
            firebaseConfig.storageBucket
          }/o/${video.path.replace(/\//g, '%2F')}?alt=media`}
          target="_blank">
          <i class="fas fa-download" />
          <span class="hidden sm:inline"
            >{$page.data.t('misc.download', {
              default: 'Download',
            })}</span>
        </Button>
      {/if} -->
