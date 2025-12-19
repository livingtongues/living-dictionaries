<script lang="ts">
  import type { Readable } from 'svelte/store'
  import ImageDropZone from './ImageDropZone.svelte'
  import type { ImageUploadStatus } from './upload-image'
  import { page } from '$app/state'

  interface Props {
    upload_image: (file: File) => Readable<ImageUploadStatus>;
    border?: boolean;
    children?: import('svelte').Snippet;
  }

  let { upload_image, border = false, children }: Props = $props();

  let upload_statuses: Readable<ImageUploadStatus>[] = $state([])
</script>

{#each upload_statuses as upload_status, index}
  {#await import('$lib/components/image/UploadImageStatus.svelte') then { default: UploadImageStatus }}
    <div class="flex flex-col grow-1">
      <UploadImageStatus
        {upload_status}
        on_finish={() => {
          upload_statuses = upload_statuses.filter((_, i) => i !== index)
        }} />
    </div>
  {/await}
{/each}

{#if !upload_statuses.length}
  <ImageDropZone {border} class="p-3 rounded" on_file_added={file => upload_statuses = [...upload_statuses, upload_image(file)]}>
    <span slot="label">
      {#if children}{@render children()}{:else}{page.data.t('misc.upload')}{/if}
    </span>
  </ImageDropZone>
{/if}
