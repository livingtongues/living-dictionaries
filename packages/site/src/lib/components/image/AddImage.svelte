<script lang="ts">
  import type { Readable } from 'svelte/store'
  import ImageDropZone from './ImageDropZone.svelte'
  import type { ImageUploadStatus } from './upload-image'
  import { page } from '$app/stores'

  export let upload_image: (file: File) => Readable<ImageUploadStatus>
  export let border = false
</script>

<ImageDropZone {border} class="p-3 rounded" let:file>
  <svelte:fragment slot="label">
    <slot>{$page.data.t('misc.upload')}</slot>
  </svelte:fragment>
  {#if file}
    {@const upload_status = upload_image(file)}
    {#await import('$lib/components/image/UploadImageStatus.svelte') then { default: UploadImageStatus }}
      <div class="flex flex-col grow-1">
        <UploadImageStatus {upload_status} />
      </div>
    {/await}
  {/if}
</ImageDropZone>
