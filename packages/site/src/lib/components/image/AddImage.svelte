<script lang="ts">
  import type { Readable } from 'svelte/store'
  import ImageDropZone from './ImageDropZone.svelte'
  import type { ImageUploadStatus } from './upload-image'
  import { page } from '$app/stores'

  export let upload_image: (file: File) => Readable<ImageUploadStatus>
  export let border = false

  let upload_statuses: Readable<ImageUploadStatus>[] = []
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
    <svelte:fragment slot="label">
      <slot>{$page.data.t('misc.upload')}</slot>
    </svelte:fragment>
  </ImageDropZone>
{/if}
