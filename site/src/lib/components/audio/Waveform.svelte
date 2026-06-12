<script lang="ts">
  import { onDestroy, onMount } from 'svelte'
  import { Button } from '$lib/svelte-pieces'
  import IconMaterialSymbolsHearing from '~icons/material-symbols/hearing'

  interface Props {
    audioUrl?: string
    audioBlob?: any
  }

  const { audioUrl = undefined, audioBlob = undefined }: Props = $props()
  let wavesurfer
  let waveform = $state()
  let playing = $state(false)

  onMount(async () => {
    const WaveSurfer = (await import('wavesurfer.js')).default
    wavesurfer = WaveSurfer.create({
      // http://wavesurfer-js.org/docs/options.html
      container: waveform,
      waveColor: '#76a9fa',
      progressColor: '#1e429f',
      cursorColor: '#1e429f',
      height: 90,
      responsive: true,
      normalize: true,
    })

    wavesurfer.on('finish', () => {
      playing = false
    })

    if (audioUrl) {
      // use https://firebase.google.com/docs/storage/web/download-files#cors_configuration to make this work
      wavesurfer.load(audioUrl)
    } else if (audioBlob) {
      wavesurfer.loadBlob(audioBlob)
    }
  })

  function startStop() {
    if (playing)
      wavesurfer.stop()
    else
      wavesurfer.play()

    playing = !playing
  }

  onDestroy(() => {
    // wavesurfer.unAll();
    wavesurfer?.destroy()
  })
</script>

<div style="display: flex; align-items: center; direction: ltr;">
  <Button
    class="waveform-play-button"
    color={playing ? 'green' : 'primary'}
    form="filled"
    onclick={startStop}>
    <IconMaterialSymbolsHearing class="icon-inline" style="margin-top: 0.25rem; margin-bottom: 0.25rem; width: 2em; height: 2em;" />
  </Button>
  <div style="flex-grow: 1" bind:this={waveform}></div>
</div>

<style>
  :global(.waveform-play-button) {
    margin-right: 0.5rem;
  }
</style>

<!-- wavesurfer.playPause(); -->

<!-- Interesting option I didn't use: https://css-tricks.com/making-an-audio-waveform-visualizer-with-vanilla-javascript/ -->
