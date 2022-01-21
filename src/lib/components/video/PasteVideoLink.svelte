<script lang="ts">
  import Button from '$svelteui/ui/Button.svelte';
  import { _ } from 'svelte-i18n';
  import { update } from '$sveltefire/firestorelite';
  import type { IEntry } from '$lib/interfaces';
  import { dictionary } from '$lib/stores';
  export let entry: IEntry;

  let URLPrompted: string;
  let videoCredit = '';
  const com = /.com/;
  const https = /https:\/\//;
  function whereSource(path: string): string {
    return path.substring(path.match(https)[0].length, path.match(com).index);
  }
  //TODO separate the update step -ask Jacob-
  async function handleInput() {
    // Validation
    let validVideoURL: string;
    videoCredit = videoCredit.trim();
    if (URLPrompted.search(https) >= 0 && URLPrompted.search(com) >= 0) {
      validVideoURL = URLPrompted.trim();
    } else {
      //TODO translate this message
      alert('This is not a valid URL');
    }
    // Check where the link comes from
    if (validVideoURL) {
      const source = whereSource(validVideoURL);
      let videoId = '';
      // Currently we only accept Vimeo and YouTube video sources
      if (source === 'www.youtube') {
        videoId = validVideoURL.substring(validVideoURL.indexOf('=') + 1);
      } else if (source === 'vimeo') {
        videoId = validVideoURL.substring(validVideoURL.match(/https:\/\/vimeo.com\//)[0].length);
      }

      await update(
        `dictionaries/${$dictionary.id}/words/${entry.id}`,
        { vf: { path: validVideoURL, externalId: videoId, vc: videoCredit } },
        true
      );
    }
  }
</script>

<form on:submit|preventDefault={handleInput}>
  <label for="vURL" class="block text-sm font-medium leading-5 text-gray-700 mt-4">
    Video URL
  </label>
  <div class="mt-1 rounded-md shadow-sm">
    <input
      id="vURL"
      type="text"
      required
      bind:value={URLPrompted}
      class="form-input block w-full" />
  </div>

  <label for="vc" class="block text-sm font-medium leading-5 text-gray-700 mt-4">
    Video credit
  </label>
  <div class="mt-1 rounded-md shadow-sm">
    <input id="vc" type="text" bind:value={videoCredit} class="form-input block w-full" />
  </div>
  <div class="modal-footer space-x-1">
    <Button type="submit" form="primary">
      {$_('misc.save', { default: 'Save' })}
    </Button>
  </div>
</form>
