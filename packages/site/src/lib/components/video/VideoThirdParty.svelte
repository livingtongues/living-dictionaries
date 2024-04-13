<script lang="ts">
  import type { ExpandedVideo } from '@living-dictionaries/types'

  export let video: Pick<ExpandedVideo, 'vimeoId' | 'youtubeId' | 'start_at_seconds'>

  let window_width: number
</script>

<svelte:window bind:innerWidth={window_width} />

<section class="flex justify-center">
  {#if video.youtubeId}
    <iframe
      id="player"
      width={window_width >= 540 ? '456' : window_width * 0.8444}
      height={window_width >= 540 ? '342' : window_width * 0.6333}
      src={`https://www.youtube.com/embed/${video.youtubeId}${video.start_at_seconds ? `?start=${video.start_at_seconds}` : ''}`}
      title="YouTube video player"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen />
  {/if}
  {#if video.vimeoId}
    <iframe
      id="player"
      width={window_width >= 540 ? '456' : window_width * 0.8444}
      height={window_width >= 540 ? '342' : window_width * 0.6333}
      src={`https://player.vimeo.com/video/${video.vimeoId}${video.start_at_seconds ? `#t=${video.start_at_seconds}` : ''}`}
      title="Vimeo video player"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen />
  {/if}
</section>
