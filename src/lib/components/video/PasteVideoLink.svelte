<script lang="ts">
  import { _ } from 'svelte-i18n';
  import { update } from '$sveltefire/firestorelite';
  import type { IEntry } from '$lib/interfaces';
  import { dictionary } from '$lib/stores';
  export let entry: IEntry;

  //export let file: File;
  const com = /.com/;
  const https = /https:\/\//;
  function whereSource(path: string): string {
    return path.substring(path.match(https)[0].length, path.match(com).index);
  }
  //TODO separate the update step
  async function handleLink() {
    const videoURL = prompt('Please paste your video URL');
    //TODO validate the videoURL
    // Check where the link comes from
    if (videoURL) {
      const source = whereSource(videoURL);
      let videoId = '';
      // Currently we only accept Vimeo and YouTube video sources
      if (source === 'www.youtube') {
        videoId = videoURL.substring(videoURL.indexOf('=') + 1);
      } else if (source === 'vimeo') {
        videoId = videoURL.substring(videoURL.match(/https:\/\/vimeo.com\//)[0].length);
      }

      await update(
        `dictionaries/${$dictionary.id}/words/${entry.id}`,
        { vf: { path: videoURL, externalId: videoId } },
        true
      );
    }
  }
</script>

<label class="mb-4" on:mousedown={handleLink}>
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
