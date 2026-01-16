<script lang="ts">
  import type { Readable } from 'svelte/store'
  import type { AudioVideoUploadStatus } from './upload-audio'
  import { page } from '$app/state'

  interface Props {
    upload_status: Readable<AudioVideoUploadStatus>;
  }

  let { upload_status }: Props = $props();
</script>

{#if $upload_status.error}
  <span
    class="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full
      text-red-600 bg-red-200">
    {page.data.t('misc.error')}: {$upload_status.error}
  </span>
{:else if $upload_status.progress === 100}
  <span
    class="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full
      text-green-600 bg-green-200">
    <i class="far fa-check"></i>
    {page.data.t('upload.success')}
  </span>
{:else}
  <div class="relative pt-1">
    <div class="flex mb-2 items-center justify-between">
      <div>
        <span
          class="text-xs font-semibold inline-block py-1 px-2 uppercase
            rounded-full text-blue-600 bg-blue-200">
          {page.data.t('upload.uploading')}
        </span>
      </div>
      <div class="text-right">
        <span class="text-xs font-semibold inline-block text-blue-600">
          {$upload_status.progress}%
        </span>
      </div>
    </div>
    <div class="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-200">
      <div
        style="width:{$upload_status.progress}%"
        class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500 smooth-width-transition"></div>
    </div>
  </div>
{/if}

<style>
  .smooth-width-transition {
    transition: width 0.5s ease;
  }
</style>
