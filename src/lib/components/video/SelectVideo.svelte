<script lang="ts">
  import { _ } from 'svelte-i18n';
  let dragging = false;
  export let file: File;

  async function handleVideo(files: FileList) {
    dragging = false;

    const fileToCheck = files.item(0);

    // Client-side validation: Must be video and smaller than ?MB.
    if (fileToCheck.type.split('/')[0] !== 'video') {
      return alert(`${$_('upload.error', { default: 'Unsupported File Type' })}`);
    }
    // Must be smaller than 100MB, http://www.unitconversion.org/data-storage/megabytes-to-bytes-conversion.html
    if (fileToCheck.size > 104857600) {
      return alert(
        `${$_('upload.file_must_be_smaller', { default: 'File must be smaller than' })} 100MB`
      );
    }

    file = fileToCheck;
    console.log('file', file);
  }
</script>

<label
  class:dragging
  on:drop|preventDefault={(e) => handleVideo(e.dataTransfer.files)}
  on:dragover|preventDefault={() => (dragging = true)}
  on:dragleave|preventDefault={() => (dragging = false)}>
  <input
    type="file"
    accept="video/*"
    class="hidden"
    on:input={(e) => {
      // @ts-ignore
      handleVideo(e.target.files);
    }} />

  <i class="far fa-upload" />&nbsp;
  {dragging
    ? $_('upload.drop_to_upload', { default: 'Drop to Upload' })
    : $_('', { default: 'Select Video File' })}
</label>

<style>
  label {
    @apply flex justify-center px-3 py-2 border font-medium
  cursor-pointer focus:outline-none border-green-300
  focus:ring focus:ring-green-300 active:bg-green-200 transition ease-in-out
  duration-150 rounded hover:bg-green-100 text-green-700;
  }

  .dragging {
    @apply bg-green-200 border-green-300 text-green-800 border-dashed;
  }
</style>
