<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { update } from '$sveltefire/firestorelite';
  import type { IEntry } from '$lib/interfaces';
  import { dictionary } from '$lib/stores';
  export let entry: IEntry;

  //export let file: File;
  async function handleLink() {
    const videoURL = prompt('Please paste your video URL');
    if (videoURL) {
      const videoId = videoURL.substring(videoURL.indexOf('=') + 1);
      await update(
        `dictionaries/${$dictionary.id}/words/${entry.id}`,
        { vf: { externalId: videoId } },
        true
      );
    }
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
  {$_('', { default: 'Paste Video Link' })}
</label>

<style>
  label {
    @apply flex justify-center px-3 py-2 border font-medium
  cursor-pointer focus:outline-none border-purple-300
  focus:ring focus:ring-purple-300 active:bg-purple-200 transition ease-in-out
  duration-150 rounded hover:bg-purple-100 text-purple-700;
  }

  /* .dragging {
    @apply bg-purple-200 border-purple-300 text-purple-800 border-dashed;
  } */
</style>
