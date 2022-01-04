<script lang="ts">
  import { _ } from 'svelte-i18n';
  //TODO dragging is not needed I guess
  let dragging = false;
  //export let file: File;
  function handleLink() {
    const videoURL = prompt('Please paste your video URL');
    console.log(videoURL);
  }
</script>

<label on:mousedown={handleLink}>
  <input
    type="url"
    class="hidden"
    on:input={(e) => {
      // @ts-ignore
    }} />

  <i class="far fa-link" />&nbsp;
  {dragging
    ? $_('upload.drop_to_upload', { default: 'Drop to Upload' })
    : $_('', { default: 'Paste Video Link' })}
</label>

<style>
  label {
    @apply flex justify-center px-3 py-2 border font-medium
  cursor-pointer focus:outline-none border-red-300
  focus:ring focus:ring-red-300 active:bg-red-200 transition ease-in-out
  duration-150 rounded hover:bg-red-100 text-red-700;
  }

  /* .dragging {
    @apply bg-red-200 border-red-300 text-red-800 border-dashed;
  } */
</style>
