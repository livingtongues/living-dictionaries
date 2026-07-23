<script lang="ts">
  import { page } from '$app/state'
  import IconMdiPlay from '~icons/mdi/play'
  import IconMdiPause from '~icons/mdi/pause'
  import IconMdiAccountVoice from '~icons/mdi/account-voice'
  import IconMdiVolumeOff from '~icons/mdi/volume-off'

  interface SpeakerLabel {
    name: string
    decade?: number | null
  }

  interface Props {
    audio_url: string
    speakers?: SpeakerLabel[]
    /** Absolute playback position in ms — bindable so the parent can drive karaoke. */
    current_ms?: number
    /** Whether the clip is playing — bindable. */
    playing?: boolean
  }

  let {
    audio_url,
    speakers = [],
    current_ms = $bindable(0),
    playing = $bindable(false),
  }: Props = $props()

  let element = $state<HTMLAudioElement | null>(null)
  let duration_ms = $state(0)
  let errored = $state(false)
  /** When set, playback pauses once the cursor reaches this ms (single-sentence play). */
  let stop_at_ms: number | null = null

  function on_time() {
    if (!element) return
    current_ms = element.currentTime * 1000
    if (stop_at_ms !== null && current_ms >= stop_at_ms) {
      element.pause()
      stop_at_ms = null
    }
  }

  function on_loaded() {
    if (element && Number.isFinite(element.duration))
      duration_ms = element.duration * 1000
  }

  export function toggle() {
    if (!element) return
    stop_at_ms = null
    if (playing)
      element.pause()
    else
      void element.play()
  }

  export function seek(ms: number) {
    if (!element) return
    element.currentTime = ms / 1000
    current_ms = ms
  }

  /** Seek to a span's start, play, and auto-pause at its end (tap-a-sentence). */
  export function play_span({ start_ms, end_ms }: { start_ms: number, end_ms: number }) {
    if (!element) return
    stop_at_ms = end_ms
    element.currentTime = start_ms / 1000
    current_ms = start_ms
    void element.play()
  }

  function on_scrub(event: Event) {
    seek(Number((event.currentTarget as HTMLInputElement).value))
  }

  function format(ms: number): string {
    const total = Math.max(0, Math.round(ms / 1000))
    const minutes = Math.floor(total / 60)
    const seconds = total % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const speaker_line = $derived(speakers
    .map(speaker => speaker.decade ? `${speaker.name} (${speaker.decade}s)` : speaker.name)
    .join(', '))
</script>

<div class="player">
  <audio
    bind:this={element}
    src={audio_url}
    preload="metadata"
    ontimeupdate={on_time}
    onloadedmetadata={on_loaded}
    ondurationchange={on_loaded}
    onplay={() => { playing = true; errored = false }}
    onpause={() => playing = false}
    onended={() => playing = false}
    onerror={() => { errored = true; playing = false }}></audio>

  <button
    type="button"
    class="play-btn"
    class:playing
    title={playing ? page.data.t('audio.pause') : page.data.t('audio.listen')}
    onclick={toggle}>
    {#if playing}
      <IconMdiPause />
    {:else}
      <IconMdiPlay style="margin-left: 0.125rem" />
    {/if}
  </button>

  <div class="body">
    <div class="scrub-row">
      <input
        class="scrub"
        type="range"
        min="0"
        max={duration_ms || 1}
        step="10"
        value={current_ms}
        aria-label={page.data.t('audio.listen')}
        oninput={on_scrub} />
      <span class="time">{format(current_ms)}{#if duration_ms} / {format(duration_ms)}{/if}</span>
    </div>

    {#if errored}
      <div class="attribution errored">
        <IconMdiVolumeOff style="font-size: 0.9375rem" />
        {page.data.t('audio.unavailable')}
      </div>
    {:else if speaker_line}
      <div class="attribution">
        <IconMdiAccountVoice style="font-size: 0.9375rem" />
        {speaker_line}
      </div>
    {/if}
  </div>
</div>

<style>
  .player {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 0.875rem;
    background: var(--surface);
    border-radius: 0.75rem;
  }

  .play-btn {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.75rem;
    height: 2.75rem;
    border-radius: 9999px;
    font-size: 1.375rem;
    background: var(--primary);
    color: var(--on-primary);
    transition: transform 75ms;
  }

  .play-btn:active {
    transform: scale(0.93);
  }

  .body {
    flex-grow: 1;
    min-width: 0;
  }

  .scrub-row {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .scrub {
    flex-grow: 1;
    min-width: 0;
    height: 0.375rem;
    accent-color: var(--primary);
    cursor: pointer;
  }

  .time {
    flex-shrink: 0;
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
    color: var(--color-secondary);
  }

  .attribution {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin-top: 0.25rem;
    font-size: 0.8125rem;
    color: var(--color-secondary);
  }

  .attribution.errored {
    color: var(--warning);
  }
</style>
