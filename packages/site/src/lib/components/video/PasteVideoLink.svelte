<script lang="ts">
  import { Button } from 'svelte-pieces'
  import type { HostedVideo } from '@living-dictionaries/types'
  import { parse_hosted_video_url } from './parse-hosted-video-url'
  import { page } from '$app/stores'

  let url: string
  export let on_pasted_valid_url: (hosted_video: HostedVideo) => void

  function handle() {
    const video = parse_hosted_video_url(url)
    if (!video) {
      alert($page.data.t('misc.invalid_url'))
      url = ''
    }
    on_pasted_valid_url(video)
  }
</script>

<form class="mb-4" on:submit|preventDefault={handle}>
  <label for="vURL" class="block text-sm font-medium leading-5 text-gray-700 mb-2">
    <i class="far fa-link" />
    {$page.data.t('video.video_url')}
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
    <Button type="submit" form={url ? 'filled' : 'outline'}>
      {$page.data.t('misc.add')}
    </Button>
  </div>
</form>
