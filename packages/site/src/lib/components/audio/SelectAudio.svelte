<script lang="ts">
  import { apply_button_label } from './audio-store'
  import { page } from '$app/stores'

  const unsupported_audio_formats = [
    'audio/aiff',
    'audio/x-aiff',
    'audio/ac3',
    'audio/wma',
    'audio/x-ms-wma',
    'audio/vnd.dolby.dd-raw',
  ]
  const unsupported_audio_extensions = [
    '.aiff',
    '.aif',
    '.aifc',
    '.ac3',
    '.wma',
  ]
  let dragging = false
  export let file: File

  function handleAudio(files: FileList) {
    dragging = false

    const fileToCheck = files.item(0)

    // Client-side validation: Must be audio and smaller than 100MB.
    if (fileToCheck.type.split('/')[0] !== 'audio')
      return alert(`${$page.data.t('upload.error')}`)

    if (unsupported_audio_formats.includes(fileToCheck.type)
      || unsupported_audio_extensions.some(ext => fileToCheck.name.endsWith(ext))) {
      return alert(`Unsupported audio format`)
    }

    // Must be smaller than 100MB, http://www.unitconversion.org/data-storage/megabytes-to-bytes-conversion.html
    if (fileToCheck.size > 104857600) {
      return alert(
        `${$page.data.t('upload.file_must_be_smaller')} 100MB`,
      )
    }

    file = fileToCheck
  }
</script>

<label
  class:dragging
  on:drop|preventDefault={e => handleAudio(e.dataTransfer.files)}
  on:dragover|preventDefault={() => (dragging = true)}
  on:dragleave|preventDefault={() => (dragging = false)}
  class:blocked={!$apply_button_label.ready_to_upload}>
  <input
    type="file"
    accept="audio/*"
    class="hidden"
    on:input={(e) => {
      // @ts-ignore
      handleAudio(e.target.files)
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

  .blocked {
   --at-apply: pointer-events-none opacity-60 cursor-not-allowed select-none px-3 py-2 border border-gray-500 text-gray-500;
  }

  .dragging {
    --at-apply: bg-green-200 border-green-300 text-green-800 border-dashed;
  }
</style>
