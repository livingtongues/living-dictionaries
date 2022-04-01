<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Button from 'svelte-pieces/ui/Button.svelte';

  export let audioUrl: string = undefined,
    audioBlob = undefined;
  let wavesurfer;
  let waveform;
  let playing = false;

  onMount(async () => {
    const WaveSurfer = (await import('wavesurfer.js')).default;
    wavesurfer = WaveSurfer.create({
      // http://wavesurfer-js.org/docs/options.html
      container: waveform,
      waveColor: '#76a9fa',
      progressColor: '#1e429f',
      cursorColor: '#1e429f',
      height: 90,
      responsive: true,
      normalize: true,
    });

    wavesurfer.on('finish', function () {
      playing = false;
    });

    if (audioUrl) {
      // use https://firebase.google.com/docs/storage/web/download-files#cors_configuration to make this work
      wavesurfer.load(audioUrl);
    } else if (audioBlob) {
      wavesurfer.loadBlob(audioBlob);
    }
  });

  function startStop() {
    if (playing) {
      wavesurfer.stop();
    } else {
      wavesurfer.play();
    }
    playing = !playing;
  }

  onDestroy(() => {
    // wavesurfer.unAll();
    wavesurfer.destroy();
  });
</script>

<div class="flex items-center" style="direction: ltr;">
  <Button class="rounded-play mr-2" form="primary" onclick={startStop}>
    {#if !playing}
      <!-- <i class="far fa-volume-up fa-lg" /> -->
      <i class="far fa-ear fa-lg" />
    {:else}
      <!-- <i class="fas fa-volume-up fa-lg" /> -->
      <i class="fas fa-ear fa-lg" />
    {/if}
  </Button>
  <div class="flex-grow" bind:this={waveform} />
</div>

<!-- wavesurfer.playPause(); -->

<!-- Interesting option I didn't use: https://css-tricks.com/making-an-audio-waveform-visualizer-with-vanilla-javascript/ -->
<style>
  :global(.rounded-play) {
    @apply !rounded-full w-12 h-12 flex-grow-0 flex
      items-center justify-center font-medium;
  }
</style>
