<script lang="ts">
  import { page } from '$app/state'
  import { apply_button_label } from './image-store'

  const { border, on_file_added = undefined, class: class_prop = '' }: {
    border: boolean
    on_file_added?: (file: File) => void
    class?: string
  } = $props()
  let dragging = $state(false)
  // const applyButtonLabel: any = getContext('applyButtonLabel')

  function handleImage(files: FileList) {
    dragging = false

    const fileToCheck = files.item(0)

    // Client-side validation: Must be an image (not SVG) and smaller than 10MB.
    if (fileToCheck.type.split('/')[0] !== 'image' || fileToCheck.type === 'image/svg+xml') {
      return alert(
        `${page.data.t('upload.error')}`,
      )
    }
    const tenMB = 10485760 // http://www.unitconversion.org/data-storage/megabytes-to-bytes-conversion.html
    if (fileToCheck.size > tenMB) {
      return alert(
        `${page.data.t('upload.file_must_be_smaller')} 10MB`,
      )
    }

    on_file_added?.(fileToCheck)
  }
</script>

<label
  class:dragging
  class:dashed-border={border}
  class:button-label={$apply_button_label.ready_to_upload}
  class:blocked={!$apply_button_label.ready_to_upload}
  class="{class_prop} text-gray-600
    h-full grow-1 flex flex-col items-center justify-center
    cursor-pointer"
  title="Add Photo"
  ondrop={(e) => { e.preventDefault(); handleImage(e.dataTransfer.files) }}
  ondragover={(e) => { e.preventDefault(); dragging = true }}
  ondragleave={(e) => { e.preventDefault(); dragging = false }}>
  <input
    type="file"
    accept="image/*"
    class="hidden"
    oninput={(e) => {
      handleImage((e.target as HTMLInputElement).files)
    }} />
  <span class="hidden md:inline">
    <span class="i-ic-outline-cloud-upload text-2xl" />
  </span>
  <span class="md:hidden">
    <span class="i-ic-outline-camera-alt text-xl" />
  </span>

  <slot name="label" />
</label>

<style>
  .blocked {
    @apply pointer-events-none opacity-60 cursor-not-allowed select-none px-3 py-2 border border-gray-500;
  }
  .button-label {
    @apply flex justify-center items-center px-3 py-2 border font-medium cursor-pointer focus:outline-none border-green-300 focus:ring focus:ring-green-300 active:bg-green-200 transition ease-in-out duration-150 rounded hover:bg-green-100 text-green-700;
  }

  .dragging {
    @apply bg-blue-200 border-blue-300 text-blue-700;
  }
  .dashed-border {
    @apply border-2 border-dashed;
  }
</style>
