<script lang="ts">
  import { page } from '$app/stores';
  let dragging = false;
  export let file: File;

  function handleAudio(files: FileList) {
    dragging = false;

    const fileToCheck = files.item(0);

    // Client-side validation: Must be audio and smaller than 100MB.
    if (fileToCheck.type.split('/')[0] !== 'audio')
      return alert(`${$page.data.t('upload.error')}`);

    // Must be smaller than 100MB, http://www.unitconversion.org/data-storage/megabytes-to-bytes-conversion.html
    if (fileToCheck.size > 104857600) {
      return alert(
        `${$page.data.t('upload.file_must_be_smaller')} 100MB`
      );
    }

    file = fileToCheck;
  }
</script>

<label
  class:dragging
  on:drop|preventDefault={(e) => handleAudio(e.dataTransfer.files)}
  on:dragover|preventDefault={() => (dragging = true)}
  on:dragleave|preventDefault={() => (dragging = false)}>
  <input
    type="file"
    accept="audio/*"
    class="hidden"
    on:input={(e) => {
      // @ts-ignore
      handleAudio(e.target.files);
    }} />

  <i class="far fa-upload" />&nbsp;
  {dragging
    ? $page.data.t('upload.drop_to_upload')
    : $page.data.t('upload.select_audio_file')}
</label>

<style>
  label {
    --at-apply: flex justify-center items-center px-3 py-2 border font-medium
  cursor-pointer focus:outline-none border-green-300
  focus:ring focus:ring-green-300 active:bg-green-200 transition ease-in-out
  duration-150 rounded hover:bg-green-100 text-green-700;
  }

  .dragging {
    --at-apply: bg-green-200 border-green-300 text-green-800 border-dashed;
  }
</style>
