<script lang="ts">
  import IconUpload from '~icons/fa-solid/upload'
  import { page } from '$app/state'

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
  let dragging = $state(false)
  interface Props {
    file: File
  }

  let { file = $bindable() }: Props = $props()

  function handleAudio(files: FileList) {
    dragging = false

    const fileToCheck = files.item(0)

    // Client-side validation: Must be audio and smaller than 100MB.
    if (fileToCheck.type.split('/')[0] !== 'audio')
      return alert(`${page.data.t('upload.error')}`)

    if (unsupported_audio_formats.includes(fileToCheck.type)
      || unsupported_audio_extensions.some(ext => fileToCheck.name.endsWith(ext))) {
      return alert(`Unsupported audio format`)
    }

    // Must be smaller than 100MB, http://www.unitconversion.org/data-storage/megabytes-to-bytes-conversion.html
    if (fileToCheck.size > 104857600) {
      return alert(
        `${page.data.t('upload.file_must_be_smaller')} 100MB`,
      )
    }

    file = fileToCheck
  }
</script>

<label
  class:dragging
  ondrop={(e: DragEvent) => { e.preventDefault(); handleAudio(e.dataTransfer.files) }}
  ondragover={(e) => { e.preventDefault(); dragging = true }}
  ondragleave={(e) => { e.preventDefault(); dragging = false }}>
  <input
    type="file"
    accept="audio/*"
    style="display: none"
    oninput={(e) => {
      // @ts-ignore
      handleAudio(e.target.files)
    }} />

  <IconUpload />&nbsp;
  {dragging
    ? page.data.t('upload.drop_to_upload')
    : page.data.t('upload.select_audio_file')}
</label>

<style>
  label {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 0.5rem 0.75rem;
    border-width: 1px;
    font-weight: 500;
    cursor: pointer;
    border-color: rgb(134 239 172); /* green-300 */
    transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 150ms;
    border-radius: 0.25rem;
    color: rgb(21 128 61); /* green-700 */
  }

  label:hover {
    background-color: rgb(220 252 231); /* green-100 */
  }

  label:active {
    background-color: rgb(187 247 208); /* green-200 */
  }

  label:focus {
    outline: 2px solid transparent;
    outline-offset: 2px;
    box-shadow: 0 0 0 3px rgb(134 239 172); /* focus ring, green-300 */
  }

  .dragging {
    background-color: rgb(187 247 208); /* green-200 */
    border-color: rgb(134 239 172); /* green-300 */
    color: rgb(22 101 52); /* green-800 */
    border-style: dashed;
  }
</style>
