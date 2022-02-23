<script lang="ts">
  import type { IVideo } from '$lib/interfaces';
  import { firebaseConfig } from '$sveltefirets';
  import VideoIFrame from './VideoIFrame.svelte';

  export let video: IVideo;
</script>

{#if video}
  {#if !video.youtubeId && !video.vimeoId}
    <video
      controls
      autoplay
      playsinline
      src={`https://firebasestorage.googleapis.com/v0/b/${
        firebaseConfig.storageBucket
      }/o/${video.path.replace(/\//g, '%2F')}?alt=media`}>
      <track kind="captions" />
    </video>
  {:else}
    <VideoIFrame {video} />
  {/if}
{/if}
