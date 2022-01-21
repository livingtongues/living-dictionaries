<script lang="ts">
  import type { IVideo } from '$lib/interfaces';
  export let videoFile: IVideo;

  let screenWidth: number;
  const com = /.com/;
  const https = /https:\/\//;
  function whereSource(path: string): string {
    return path.substring(path.match(https)[0].length, path.match(com).index);
  }
</script>

<svelte:window bind:innerWidth={screenWidth} />

<section class="flex justify-center">
  {#if whereSource(videoFile.path) === 'www.youtube'}
    <iframe
      id="player"
      type="text/html"
      width={screenWidth >= 540 ? '456' : screenWidth >= 425 ? '342' : '247'}
      height={screenWidth >= 540 ? '342' : screenWidth >= 425 ? '256' : '200'}
      src={`https://www.youtube.com/embed/${videoFile.externalId}`}
      title="YouTube video player"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen />
  {:else if whereSource(videoFile.path) === 'vimeo'}
    <iframe
      id="player"
      type="text/html"
      width={screenWidth >= 540 ? '456' : screenWidth >= 425 ? '342' : '247'}
      height={screenWidth >= 540 ? '342' : screenWidth >= 425 ? '256' : '200'}
      src={`https://player.vimeo.com/video/${videoFile.externalId}`}
      title="Vimeo video player"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen />
  {/if}
</section>
