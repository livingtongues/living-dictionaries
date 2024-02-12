<script lang="ts">
  import { page } from '$app/stores';
  import type { Readable } from 'svelte/store';
  import type { ImageUploadStatus } from './upload-image';

  export let image_upload_status: Readable<ImageUploadStatus>;
</script>

<div
  class="w-full h-full flex-grow relative flex flex-col items-center justify-center
    overflow-hidden">
  {#if $image_upload_status.error}
    <div class="p-2 text-red-600 text-center">
      <div><span class="i-fa-solid-times" /></div>
      {$page.data.t('misc.error')}: {$image_upload_status.error}
    </div>
  {:else}
    {#if $image_upload_status.serving_url}
      <div class="w-12 text-dark-shadow text-white text-3xl z-10 text-center">
        <span class="i-fa6-solid-check" />
      </div>
    {:else}
      <div
        class="text-dark-shadow text-white z-10 font-semibold w-12 text-center
          font-mono">
        {$image_upload_status.progress}%
      </div>
    {/if}
    {#if $image_upload_status.preview_url}
      <img class="object-cover h-full w-full absolute inset-0" src={$image_upload_status.preview_url} />
    {/if}
    <div style="height:{100 - $image_upload_status.progress}%" class="bg-gray-200 opacity-75 absolute top-0 w-full smooth-height-transition" />
  {/if}
</div>

<style>
  .smooth-height-transition {
    transition: height 0.5s ease;
  }
</style>
