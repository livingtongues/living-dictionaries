<script lang="ts">
  import type { Snippet } from 'svelte'
  import { apply_button_label } from './image-store'
  import { page } from '$app/state'
  import IconIcOutlineCloudUpload from '~icons/ic/outline-cloud-upload'
  import IconIcOutlineCameraAlt from '~icons/ic/outline-camera-alt'

  interface Props {
    border: boolean
    on_file_added?: (file: File) => void
    require_entry_fields?: boolean
    class?: string
    label?: Snippet
  }

  const { border, on_file_added = undefined, require_entry_fields = false, class: klass = '', label }: Props = $props()
  let dragging = $state(false)

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
  class:button-label={require_entry_fields && $apply_button_label.ready_to_upload}
  class:blocked={require_entry_fields && !$apply_button_label.ready_to_upload}
  class="{klass} drop-zone"
  title="Add Photo"
  ondrop={(e) => { e.preventDefault(); handleImage(e.dataTransfer.files) }}
  ondragover={(e) => { e.preventDefault(); dragging = true }}
  ondragleave={(e) => { e.preventDefault(); dragging = false }}>
  <input
    type="file"
    accept="image/*"
    style="display: none"
    oninput={(e) => {
      // @ts-expect-error
      handleImage(e.target.files)
    }} />
  <span class="desktop-only">
    <IconIcOutlineCloudUpload class="icon-inline" style="font-size: 1.5rem" />
  </span>
  <span class="mobile-only">
    <IconIcOutlineCameraAlt class="icon-inline" style="font-size: 1.25rem" />
  </span>

  {@render label?.()}
</label>

<style>
  .drop-zone {
    color: color-mix(in srgb, var(--color) 75%, var(--background)); /* ≈ gray-600 */
    height: 100%;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .desktop-only {
    display: none;
  }

  @media (min-width: 768px) {
    .desktop-only {
      display: inline;
    }

    .mobile-only {
      display: none;
    }
  }

  .blocked {
    pointer-events: none;
    opacity: 0.6;
    cursor: not-allowed;
    user-select: none;
    padding: 0.5rem 0.75rem;
    border-width: 1px;
    border-color: var(--color-secondary); /* ≈ gray-500 */
  }

  .button-label {
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

  .button-label:hover {
    background-color: rgb(220 252 231); /* green-100 */
  }

  .button-label:active {
    background-color: rgb(187 247 208); /* green-200 */
  }

  .button-label:focus {
    outline: 2px solid transparent;
    outline-offset: 2px;
    --un-ring-width: 3px;
    --un-ring-offset-shadow: var(--un-ring-inset) 0 0 0 var(--un-ring-offset-width) var(--un-ring-offset-color);
    --un-ring-shadow: var(--un-ring-inset) 0 0 0 calc(var(--un-ring-width) + var(--un-ring-offset-width)) var(--un-ring-color);
    box-shadow: var(--un-ring-offset-shadow), var(--un-ring-shadow), var(--un-shadow);
    --un-ring-opacity: 1;
    --un-ring-color: rgb(134 239 172 / var(--un-ring-opacity)); /* focus:ring-green-300 */
  }

  .dragging {
    background-color: rgb(191 219 254); /* blue-200 */
    border-color: rgb(147 197 253); /* blue-300 */
    color: rgb(29 78 216); /* blue-700 */
  }

  .dashed-border {
    border-width: 2px;
    border-style: dashed;
  }
</style>
