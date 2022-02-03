<script lang="ts">
  import { _ } from 'svelte-i18n';
  import Button from '$svelteui/ui/Button.svelte';
  let url: string;

  import { createEventDispatcher } from 'svelte';
  import { parseVideoId } from './parseVideoId';
  const dispatch =
    createEventDispatcher<{ update: { videoId: string; type: 'vimeo' | 'youtube' } }>();

  function handle() {
    const detail = parseVideoId(url);
    if (!detail) {
      alert($_('misc.invalid_url', { default: 'This is not a valid URL' }));
      url = '';
      return;
    }
    dispatch('update', detail);
  }
</script>

<form class="mb-4" on:submit|preventDefault={handle}>
  <label for="vURL" class="block text-sm font-medium leading-5 text-gray-700 mb-2">
    <i class="far fa-link" />
    {$_('video.video_url', { default: 'Video URL' })}
  </label>
  <div class="flex">
    <div class="rounded-md shadow-sm flex-grow">
      <input
        id="vURL"
        type="url"
        placeholder="Paste YouTube or Vimeo link"
        required
        bind:value={url}
        class="form-input block w-full" />
    </div>
    <div class="w-1" />
    <Button type="submit" form={url ? 'primary' : 'outline'}>
      {$_('misc.add', { default: 'Add' })}
    </Button>
  </div>
  <!-- <label for="vc" class="block text-sm font-medium leading-5 text-gray-700 mt-4">
    {$_('video.video_credit', { default: 'Video credit' })}
  </label>
  <div class="mt-1 rounded-md shadow-sm">
    <input id="vc" type="text" bind:value={videoCredit} class="form-input block w-full" />
  </div> -->
</form>
