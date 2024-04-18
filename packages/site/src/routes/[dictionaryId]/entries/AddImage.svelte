<script lang="ts">
  import { page } from '$app/stores'
  import type { DbOperations } from '$lib/dbOperations'

  export let entryId: string
  export let dictionaryId: string
  export let updateEntryOnline: DbOperations['updateEntryOnline']
  $: ({ user } = $page.data)

  let dragging = false
  let file: File

  function handleImage(files: FileList) {
    dragging = false

    const fileToCheck = files.item(0)

    // Client-side validation: Must be an image and smaller than 10MB.
    if (fileToCheck.type.split('/')[0] !== 'image') {
      return alert(`${$page.data.t('upload.error')}`)
    }
    const tenMB = 10485760 // http://www.unitconversion.org/data-storage/megabytes-to-bytes-conversion.html
    if (fileToCheck.size > tenMB) {
      return alert(`${$page.data.t('upload.file_must_be_smaller')} 10MB`)
    }

    file = fileToCheck
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

      <slot name="text" />
    </label>
  {:else}
    {#await import('$lib/components/image/UploadImage.svelte') then { default: UploadImage }}
      <UploadImage
        {file}
        user={$user}
        fileLocationPrefix="{dictionaryId}/images/{entryId}_"
        on:uploaded={async ({ detail: { fb_storage_path, specifiable_image_url } }) => await updateEntryOnline({ data: { pf: {
          path: fb_storage_path,
          gcs: specifiable_image_url,
          ts: new Date().getTime(),
          cr: $user.displayName,
          ab: $user.uid,
        } }, entryId })} />
    {/await}
  {/if}
</div>

<style>
  .dragging {
    --at-apply: bg-blue-200 border-blue-300 text-blue-700;
  }
</style>
