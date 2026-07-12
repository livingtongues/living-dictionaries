<script lang="ts">
  import HeadlessButton from '$lib/components/ui/HeadlessButton.svelte'
  import IconMaterialSymbolsHearing from '~icons/material-symbols/hearing'
  import { decode_audio_buffer, get_peaks } from './waveform-utils'

  // Pared down from tutor's audio stack — zoom/scroll, section highlighting, paragraph
  // segments, and live-recording rendering live in tutor: site/src/lib/audio/Waveform.svelte
  // + audio-player.svelte.ts. LD only needs a static waveform with play/stop + progress.

  interface Props {
    audioUrl?: string
    audioBlob?: Blob
  }

  const { audioUrl = undefined, audioBlob = undefined }: Props = $props()

  const HEIGHT = 90
  const NUM_PEAKS = 200
  const BAR_WIDTH = 3
  const BAR_GAP = 2

  let container: HTMLDivElement | undefined = $state()
  let canvas: HTMLCanvasElement | undefined = $state()
  let container_width = $state(0)

  let peaks: number[] = $state([])
  let duration = $state(0)
  let current_time = $state(0)
  let playing = $state(false)

  let audio: HTMLAudioElement | null = null
  let object_url: string | null = null
  let frame: number | null = null
  let load_token = 0

  $effect(() => {
    void audioUrl
    void audioBlob
    setup()
    return cleanup
  })

  function setup() {
    if (!audioUrl && !audioBlob) return
    // The playback element is usable immediately (the browser buffers on demand), so a tap
    // on play before peak decoding finishes just awaits audio.play() — Button shows its
    // loading spinner meanwhile and playback auto-starts the moment it's buffered.
    if (audioUrl) {
      audio = new Audio(audioUrl)
    } else {
      object_url = URL.createObjectURL(audioBlob)
      audio = new Audio(object_url)
    }
    audio.onplay = () => {
      playing = true
      track()
    }
    audio.onpause = () => {
      playing = false
      stop_tracking()
    }
    audio.onended = () => {
      current_time = 0
      if (audio) audio.currentTime = 0
    }
    load_peaks()
  }

  async function load_peaks() {
    const token = ++load_token
    try {
      // fetching the storage URL requires CORS on the bucket:
      // https://firebase.google.com/docs/storage/web/download-files#cors_configuration
      const source = audioBlob ?? await (await fetch(audioUrl)).arrayBuffer()
      const buffer = await decode_audio_buffer(source)
      if (token !== load_token) return
      ({ duration } = buffer)
      peaks = get_peaks(buffer, NUM_PEAKS)
    } catch (error) {
      console.error('Unable to decode audio for waveform', error)
    }
  }

  function track() {
    if (!audio) return
    current_time = audio.currentTime
    frame = requestAnimationFrame(track)
  }

  function stop_tracking() {
    if (frame) cancelAnimationFrame(frame)
    frame = null
  }

  function cleanup() {
    load_token++
    stop_tracking()
    if (audio) {
      audio.pause()
      audio.onplay = null
      audio.onpause = null
      audio.onended = null
      audio = null
    }
    if (object_url) {
      URL.revokeObjectURL(object_url)
      object_url = null
    }
    peaks = []
    duration = 0
    current_time = 0
    playing = false
  }

  async function start_stop() {
    if (!audio) return
    if (playing) {
      audio.pause()
      audio.currentTime = 0
      current_time = 0
    } else {
      await audio.play()
    }
  }

  function seek(event: MouseEvent) {
    if (!audio || !duration || !canvas) return
    const rect = canvas.getBoundingClientRect()
    const ratio = (event.clientX - rect.left) / rect.width
    audio.currentTime = ratio * duration
    current_time = audio.currentTime
  }

  $effect(() => {
    if (!container) return
    const observer = new ResizeObserver((entries) => {
      container_width = entries[0].contentRect.width
    })
    observer.observe(container)
    return () => observer.disconnect()
  })

  $effect(() => {
    if (!canvas || !container_width) return
    void peaks.length
    void current_time
    draw()
  })

  function draw() {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const pixel_ratio = window.devicePixelRatio || 1
    canvas.width = container_width * pixel_ratio
    canvas.height = HEIGHT * pixel_ratio
    ctx.scale(pixel_ratio, pixel_ratio)
    ctx.clearRect(0, 0, container_width, HEIGHT)

    const bar_color = getComputedStyle(canvas).color // var(--primary), mode-aware
    const half_height = HEIGHT / 2

    if (peaks.length === 0) {
      // Decode still in flight: a subtle center line keeps the layout stable
      ctx.globalAlpha = 0.35
      ctx.fillStyle = bar_color
      ctx.fillRect(0, half_height - 1, container_width, 2)
      return
    }

    const total_bar_width = BAR_WIDTH + BAR_GAP
    const num_bars = Math.ceil(container_width / total_bar_width)
    const peaks_per_bar = peaks.length / num_bars
    const progress_x = duration > 0 ? (current_time / duration) * container_width : 0

    for (let i = 0; i < num_bars; i++) {
      const x = i * total_bar_width
      const peak_index = Math.floor(i * peaks_per_bar)
      const peak_value = peaks[Math.min(peak_index, peaks.length - 1)] || 0
      const bar_height = Math.max(2, peak_value * (half_height - 2))

      ctx.globalAlpha = x < progress_x ? 1 : 0.35
      ctx.fillStyle = bar_color
      ctx.beginPath()
      ctx.roundRect(x, half_height - bar_height, BAR_WIDTH, bar_height * 2, BAR_WIDTH / 2)
      ctx.fill()
    }

    if (current_time > 0) {
      ctx.globalAlpha = 1
      ctx.strokeStyle = bar_color
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(progress_x, 0)
      ctx.lineTo(progress_x, HEIGHT)
      ctx.stroke()
    }
  }
</script>

<div style="display: flex; align-items: center; direction: ltr;">
  <HeadlessButton
    class="btn-primary waveform-play-button {playing ? 'playing' : ''}"
    onclick={start_stop}>
    <IconMaterialSymbolsHearing style="margin-top: 0.25rem; margin-bottom: 0.25rem; width: 2em; height: 2em;" />
  </HeadlessButton>
  <div bind:this={container} class="waveform" style:height="{HEIGHT}px">
    <canvas bind:this={canvas} onclick={seek} style:height="{HEIGHT}px"></canvas>
  </div>
</div>

<style>
  :global(.waveform-play-button) {
    margin-right: 0.5rem;
  }
  .waveform {
    flex-grow: 1;
    min-width: 0;
    color: var(--primary);
  }
  canvas {
    display: block;
    width: 100%;
    cursor: pointer;
  }
</style>
