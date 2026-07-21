<script lang="ts">
  import IconLink from '~icons/fa-solid/link'
  import type { HostedMetadata, HostedVideo } from '$lib/types'
  import { parse_hosted_video_url } from './parse-hosted-video-url'
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import { page } from '$app/state'
  import { api_video_hosted_metadata } from '$api/video/hosted-metadata/_call'

  let url: string = $state()
  interface Props {
    on_pasted_valid_url: (value: { hosted_video: HostedVideo, hosted_metadata?: HostedMetadata }) => void
  }

  const { on_pasted_valid_url }: Props = $props()

  async function handle() {
    const video = parse_hosted_video_url(url)
    if (!video) {
      alert(page.data.t('misc.invalid_url'))
      url = ''
      return
    }
    const { data } = await api_video_hosted_metadata({ hosted_video: video })
    on_pasted_valid_url({ hosted_video: video, ...(data?.metadata ? { hosted_metadata: data.metadata } : {}) })
  }
</script>

<form style="margin-bottom: 1rem" onsubmit={async (event) => { event.preventDefault(); await handle() }}>
  <label for="vURL">
    <IconLink />
    {page.data.t('video.video_url')}
  </label>
  <div style="display: flex">
    <div class="input-shadow-wrap">
      <input
        id="vURL"
        type="url"
        placeholder="Paste YouTube or Vimeo link"
        required
        bind:value={url} />
    </div>
    <div style="width: 0.25rem"></div>
    <HeadlessButton type="submit" class="btn-primary btn-default">
      {page.data.t('misc.add')}
    </HeadlessButton>
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
