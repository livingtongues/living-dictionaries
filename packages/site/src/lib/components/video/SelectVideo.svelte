<script lang="ts">
  import { page } from '$app/state';
  interface Props {
    children?: import('svelte').Snippet<[any]>;
  }

  let { children }: Props = $props();
  let dragging = $state(false);
  let file: File = $state();

  function checkVideo(files: FileList) {
    dragging = false;

    const fileToCheck = files.item(0);

    // Client-side validation: Must be video and smaller than 100MB.
    if (fileToCheck.type.split('/')[0] !== 'video')
      return alert(`${page.data.t('upload.error')}`);

    // Must be smaller than 100MB, http://www.unitconversion.org/data-storage/megabytes-to-bytes-conversion.html
    if (fileToCheck.size > 104857600) {
      return alert(
        `${page.data.t('upload.file_must_be_smaller')} 100MB`
      );
    }

    file = fileToCheck;
  }
</script>

{#if file}
  {@render children?.({ file, })}
{:else}
  <label
    class:dragging
    ondrop={(e) => { e.preventDefault(); checkVideo(e.dataTransfer.files); }}
    ondragover={(e) => { e.preventDefault(); dragging = true; }}
    ondragleave={(e) => { e.preventDefault(); dragging = false; }}>
    <input
      type="file"
      accept="video/*"
      class="hidden"
      oninput={(e: Event & { currentTarget: HTMLInputElement }) => {
        checkVideo(e.currentTarget.files);
      }} />

    <div>
      <i class="far fa-upload"></i>&nbsp;
      {dragging
        ? page.data.t('upload.drop_to_upload')
        : page.data.t('upload.select_video_file')}
    </div>
    <div class="text-xs">
      {page.data.t('upload.file_must_be_smaller')} 100MB
    </div>
  </label>
{/if}

<style>
  label {
    @apply flex flex-col justify-center px-3 py-2 border font-medium
  cursor-pointer focus:outline-none border-green-300
  focus:ring focus:ring-green-300 active:bg-green-200 transition ease-in-out
  duration-150 rounded hover:bg-green-100 text-green-700;
  }

  .dragging {
    @apply bg-green-200 border-green-300 text-green-800 border-dashed;
  }
</style>
