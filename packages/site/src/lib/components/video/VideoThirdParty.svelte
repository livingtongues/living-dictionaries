<script lang="ts">
  import type { HostedVideo } from '@living-dictionaries/types'

  export let hosted_video: HostedVideo

  let window_width: number
</script>

<svelte:window bind:innerWidth={window_width} />

<section class="flex justify-center">
  {#if hosted_video.type === 'youtube'}
    <iframe
      id="player"
      width={window_width >= 540 ? '456' : window_width * 0.8444}
      height={window_width >= 540 ? '342' : window_width * 0.6333}
      src={`https://www.youtube.com/embed/${hosted_video.video_id}${hosted_video.start_at_seconds ? `?start=${hosted_video.start_at_seconds}` : ''}`}
      title="YouTube video player"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen />
  {/if}
  {#if hosted_video.type === 'vimeo'}
    <iframe
      id="player"
      width={window_width >= 540 ? '456' : window_width * 0.8444}
      height={window_width >= 540 ? '342' : window_width * 0.6333}
      src={`https://player.vimeo.com/video/${hosted_video.video_id}${hosted_video.start_at_seconds ? `#t=${hosted_video.start_at_seconds}` : ''}`}
      title="Vimeo video player"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen />
  {/if}
</section>
