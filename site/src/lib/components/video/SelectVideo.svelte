<script lang="ts">
  import { preventDefault } from 'svelte/legacy'

  import { page } from '$app/state'

  interface Props {
    children?: import('svelte').Snippet<[any]>
  }

  const { children }: Props = $props()
  let dragging = $state(false)
  let file: File = $state()

  function checkVideo(files: FileList) {
    dragging = false

    const fileToCheck = files.item(0)

    // Client-side validation: Must be video and smaller than 100MB.
    if (fileToCheck.type.split('/')[0] !== 'video')
      return alert(`${page.data.t('upload.error')}`)

    // Must be smaller than 100MB, http://www.unitconversion.org/data-storage/megabytes-to-bytes-conversion.html
    if (fileToCheck.size > 104857600) {
      return alert(
        `${page.data.t('upload.file_must_be_smaller')} 100MB`,
      )
    }

    file = fileToCheck
  }
</script>

{#if file}
  {@render children?.({ file })}
{:else}
  <label
    class:dragging
    ondrop={preventDefault((e: DragEvent) => checkVideo(e.dataTransfer.files))}
    ondragover={preventDefault(() => (dragging = true))}
    ondragleave={preventDefault(() => (dragging = false))}>
    <input
      type="file"
      accept="video/*"
      style="display: none"
      oninput={(e) => {
        // @ts-ignore
        checkVideo(e.target.files)
      }} />

    <div>
      <i class="far fa-upload"></i>&nbsp;
      {dragging
        ? page.data.t('upload.drop_to_upload')
        : page.data.t('upload.select_video_file')}
    </div>
    <div style="font-size: 0.75rem; line-height: 1rem">
      {page.data.t('upload.file_must_be_smaller')} 100MB
    </div>
  </label>
{/if}

<style>
  label {
    display: flex;
    flex-direction: column;
    justify-content: center;
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
    --un-ring-width: 3px;
    --un-ring-offset-shadow: var(--un-ring-inset) 0 0 0 var(--un-ring-offset-width) var(--un-ring-offset-color);
    --un-ring-shadow: var(--un-ring-inset) 0 0 0 calc(var(--un-ring-width) + var(--un-ring-offset-width)) var(--un-ring-color);
    box-shadow: var(--un-ring-offset-shadow), var(--un-ring-shadow), var(--un-shadow);
    --un-ring-opacity: 1;
    --un-ring-color: rgb(134 239 172 / var(--un-ring-opacity)); /* focus:ring-green-300 */
  }

  .dragging {
    background-color: rgb(187 247 208); /* green-200 */
    border-color: rgb(134 239 172); /* green-300 */
    color: rgb(22 101 52); /* green-800 */
    border-style: dashed;
  }
</style>
