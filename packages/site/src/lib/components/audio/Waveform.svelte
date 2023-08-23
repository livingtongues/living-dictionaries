<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Button } from 'svelte-pieces';

  export let audioUrl: string = undefined
  export let audioBlob = undefined;
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
  <Button
    class="mr-2"
    color={playing ? 'green' : 'primary'}
    form="filled"
    onclick={startStop}>
    <span class="i-material-symbols-hearing my-1" style="width: 2em; height: 2em;" />
  </Button>
  <div class="flex-grow" bind:this={waveform} />
</div>

<!-- wavesurfer.playPause(); -->

<!-- Interesting option I didn't use: https://css-tricks.com/making-an-audio-waveform-visualizer-with-vanilla-javascript/ -->
