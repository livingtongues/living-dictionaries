<script lang="ts">
  import type { GoalDatabasePhoto, IEntry } from '@living-dictionaries/types';
  import { t } from 'svelte-i18n';
  import { updateOnline } from 'sveltefirets';
  import { get } from 'svelte/store';

  export let entry: IEntry;
  export let dictionaryId: string;

  let dragging = false;
  let file: File;

  function handleImage(files: FileList) {
    dragging = false;

    const fileToCheck = files.item(0);

    // Client-side validation: Must be an image and smaller than 10MB.
    if (fileToCheck.type.split('/')[0] !== 'image') {
      return alert(
        // @ts-ignore
        `${$t('upload.error', { default: 'Unsupported File Type' })}`
      );
    }
    const tenMB = 10485760; // http://www.unitconversion.org/data-storage/megabytes-to-bytes-conversion.html
    if (fileToCheck.size > tenMB) {
      // @ts-ignore
      return alert(
        `${$t('upload.file_must_be_smaller', {
          default: 'File must be smaller than',
        })} 10MB`
      );
    }

    file = fileToCheck;
  }

  async function saveImage(fb_storage_path: string, specifiable_image_url: string) {
    const { user } = await import('$lib/stores');
    const {displayName, uid} = get(user);
    const pf: GoalDatabasePhoto = {
      path: fb_storage_path,
      gcs: specifiable_image_url,
      ts: new Date().getTime(),
      cr: displayName,
      ab: uid,
    }
    await updateOnline<IEntry>(`dictionaries/${dictionaryId}/words/${entry.id}`, { pf} ,
      { abbreviate: true }
    )
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
        fileLocationPrefix="{dictionaryId}/images/{entry.id}_"
        on:uploaded={({detail: {fb_storage_path, specifiable_image_url}}) => saveImage(fb_storage_path, specifiable_image_url)} />
    {/await}
  {/if}
</div>

<style>
  .dragging {
    --at-apply: bg-blue-200 border-blue-300 text-blue-700;
  }
</style>
