<script lang="ts">
  import type { IVideo } from '$lib/interfaces';
  export let videoFile: IVideo;

  let screenWidth: number;
</script>

<svelte:window bind:innerWidth={screenWidth} />

<section class="flex justify-center">
  {#if videoFile.youtubeId}
    <iframe
      id="player"
      type="text/html"
      width={screenWidth >= 540 ? '456' : screenWidth * 0.8444}
      height={screenWidth >= 540 ? '342' : screenWidth * 0.6333}
      src={`https://www.youtube.com/embed/${videoFile.youtubeId}`}
      title="YouTube video player"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen />
  {/if}
  {#if videoFile.vimeoId}
    <iframe
      id="player"
      type="text/html"
      width={screenWidth >= 540 ? '456' : screenWidth * 0.8444}
      height={screenWidth >= 540 ? '342' : screenWidth * 0.6333}
      src={`https://player.vimeo.com/video/${videoFile.vimeoId}`}
      title="Vimeo video player"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen />
  {/if}
</section>
