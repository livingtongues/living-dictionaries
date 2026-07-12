<script lang="ts">
  import ImageDropZone from './ImageDropZone.svelte'
  import type { MediaUploadHandle } from '$lib/media/upload-media'
  import { page } from '$app/state'

  interface Props {
    upload_image: (file: File) => MediaUploadHandle
    border?: boolean
    require_entry_fields?: boolean
    children?: import('svelte').Snippet
  }

  const {
    upload_image,
    border = false,
    require_entry_fields = false,
    children,
  }: Props = $props()

  let upload_handles: MediaUploadHandle[] = $state([])
</script>

{#each upload_handles as handle, index (index)}
  {#await import('$lib/components/image/UploadImageStatus.svelte') then { default: UploadImageStatus }}
    <div style="display: flex; flex-direction: column; flex-grow: 1">
      <UploadImageStatus
        {handle}
        on_finish={() => {
          upload_handles = upload_handles.filter((_, i) => i !== index)
        }} />
    </div>
  {/await}
{/each}

{#if !upload_handles.length}
  <ImageDropZone {border} {require_entry_fields} class="image-drop-pad" on_file_added={file => upload_handles = [...upload_handles, upload_image(file)]}>
    {#snippet label()}

      {#if children}{@render children()}{:else}{page.data.t('misc.upload')}{/if}

    {/snippet}
  </ImageDropZone>
{/if}

<style>
  /* lands on the ImageDropZone label (child component root) */
  :global(.image-drop-pad) {
    padding: 0.75rem;
    border-radius: 0.25rem;
  }
</style>
