<script lang="ts">
  import type { IVideo } from '@living-dictionaries/types';
  export let video: IVideo;

  let screenWidth: number;
</script>

<svelte:window bind:innerWidth={screenWidth} />

<section class="flex justify-center">
  {#if video.youtubeId}
    <iframe
      id="player"
      type="text/html"
      width={screenWidth >= 540 ? '456' : screenWidth * 0.8444}
      height={screenWidth >= 540 ? '342' : screenWidth * 0.6333}
      src={`https://www.youtube.com/embed/${video.youtubeId}`}
      title="YouTube video player"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen />
  {/if}
  {#if video.vimeoId}
    <iframe
      id="player"
      type="text/html"
      width={screenWidth >= 540 ? '456' : screenWidth * 0.8444}
      height={screenWidth >= 540 ? '342' : screenWidth * 0.6333}
      src={`https://player.vimeo.com/video/${video.vimeoId}`}
      title="Vimeo video player"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen />
  {/if}
</section>
