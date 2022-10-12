<script lang="ts">
  import type { IEntry } from '@living-dictionaries/types';
  import { _ } from 'svelte-i18n';

  export let entry: IEntry;
  let dragging = false;
  let file: File;

  async function handleImage(files: FileList) {
    dragging = false;

    const fileToCheck = files.item(0);

    // Client-side validation: Must be an image and smaller than 10MB.
    if (fileToCheck.type.split('/')[0] !== 'image') {
      return alert(
        // @ts-ignore
        `${$_('upload.error', { default: 'Unsupported File Type' })}`
      );
    }
    // Must be smaller than 10MB, http://www.unitconversion.org/data-storage/megabytes-to-bytes-conversion.html
    if (fileToCheck.size > 10485760) {
      // @ts-ignore
      return alert(
        `${$_('upload.file_must_be_smaller', {
          default: 'File must be smaller than',
        })} 10MB`
      );
    }

    file = fileToCheck;
  }
</script>

<div class="{$$props.class} hover:bg-gray-300 flex flex-col">
  {#if !file}
    <label
      class:dragging
      class="text-gray-600 border-transparent
      h-full flex flex-col items-center justify-center border-2 border-dashed
      cursor-pointer"
      title="Add Photo to Entry"
      on:drop|preventDefault={(e) => handleImage(e.dataTransfer.files)}
      on:dragover|preventDefault={() => (dragging = true)}
      on:dragleave|preventDefault={() => (dragging = false)}>
      <input
        type="file"
        accept="image/*"
        class="hidden"
        on:input={(e) => {
          // @ts-ignore
          handleImage(e.target.files);
        }} />
      <span class="hidden md:inline">
        <i class="far fa-upload" />
      </span>
      <span class="md:hidden">
        <i class="far fa-camera" />
      </span>

      <slot name="text" />
    </label>
  {:else}
    {#await import('$lib/components/image/UploadImage.svelte') then { default: UploadImage }}
      <UploadImage {file} {entry} />
    {/await}
  {/if}
</div>

<style>
  .dragging {
    --at-apply: bg-blue-200 !border-blue-300 !text-blue-700;
  }
</style>
