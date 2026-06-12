<script lang="ts">
  import { preventDefault } from 'svelte/legacy'

  import type { HostedVideo } from '$lib/types'
  import { parse_hosted_video_url } from './parse-hosted-video-url'
  import { Button } from '$lib/svelte-pieces'
  import { page } from '$app/stores'

  let url: string = $state()
  interface Props {
    on_pasted_valid_url: (hosted_video: HostedVideo) => void
  }

  const { on_pasted_valid_url }: Props = $props()

  function handle() {
    const video = parse_hosted_video_url(url)
    if (!video) {
      alert($page.data.t('misc.invalid_url'))
      url = ''
    }
    on_pasted_valid_url(video)
  }
</script>

<form style="margin-bottom: 1rem" onsubmit={preventDefault(handle)}>
  <label for="vURL">
    <i class="far fa-link"></i>
    {$page.data.t('video.video_url')}
  </label>
  <div style="display: flex">
    <div class="input-shadow-wrap">
      <input
        id="vURL"
        type="url"
        placeholder="Paste YouTube or Vimeo link"
        required
        bind:value={url}
        class="form-input" />
    </div>
    <div style="width: 0.25rem"></div>
    <Button type="submit" form={url ? 'filled' : 'outline'}>
      {$page.data.t('misc.add')}
    </Button>
  </div>
</form>

<style>
  label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.25rem;
    color: color-mix(in srgb, var(--color) 85%, var(--background)); /* ≈ gray-700 */
    margin-bottom: 0.5rem;
  }

  .input-shadow-wrap {
    border-radius: 0.375rem;
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); /* shadow-sm */
    flex-grow: 1;
  }

  .input-shadow-wrap input {
    display: block;
    width: 100%;
  }
</style>
