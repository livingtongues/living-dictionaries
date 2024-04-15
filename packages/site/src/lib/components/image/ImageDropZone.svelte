<script lang="ts">
  import { page } from '$app/stores'

  let dragging = false
  let file: File

  function handleImage(files: FileList) {
    dragging = false

    const fileToCheck = files.item(0)

    // Client-side validation: Must be an image (not SVG) and smaller than 10MB.
    if (fileToCheck.type.split('/')[0] !== 'image' || fileToCheck.type === 'image/svg+xml') {
      return alert(
        `${$page.data.t('upload.error')}`,
      )
    }
    const tenMB = 10485760 // http://www.unitconversion.org/data-storage/megabytes-to-bytes-conversion.html
    if (fileToCheck.size > tenMB) {
      return alert(
        `${$page.data.t('upload.file_must_be_smaller')} 10MB`,
      )
    }

    file = fileToCheck
  }
</script>

{#if !file}
  <label
    class:dragging
    class="{$$props.class} text-gray-600
      h-full grow-1 flex flex-col items-center justify-center border-2 border-dashed
      cursor-pointer"
    title="Add Photo"
    on:drop|preventDefault={e => handleImage(e.dataTransfer.files)}
    on:dragover|preventDefault={() => (dragging = true)}
    on:dragleave|preventDefault={() => (dragging = false)}>
    <input
      type="file"
      accept="image/*"
      class="hidden"
      on:input={(e) => {
        // @ts-expect-error
        handleImage(e.target.files)
      }} />
    <span class="hidden md:inline">
      <span class="i-ic-outline-cloud-upload text-2xl" />
    </span>
    <span class="md:hidden">
      <span class="i-ic-outline-camera-alt text-xl" />
    </span>

    <slot name="label" />
  </label>
{:else}
  <slot {file} />
{/if}

<style>
  .dragging {
    --at-apply: bg-blue-200 border-blue-300 text-blue-700;
  }
</style>
