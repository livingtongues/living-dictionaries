import { play_audio_element } from '$lib/media/play-audio-element'

let stop_current: (() => void) | null = null

/** In-place card audio playback — one card plays at a time across the whole page. */
export function create_exclusive_audio() {
  let playing = $state(false)
  let audio_element: HTMLAudioElement | null = null

  function stop() {
    audio_element?.pause()
    playing = false
  }

  function toggle(url: string) {
    if (playing) {
      stop()
      stop_current = null
      return
    }
    stop_current?.()
    stop_current = stop
    audio_element = new Audio(url)
    audio_element.onended = stop
    audio_element.onerror = stop
    playing = true
    // A rejected play() never reaches `onerror`, so without this the card would
    // sit showing a pause icon forever with nothing playing.
    play_audio_element({ audio: audio_element, context: { surface: 'exclusive_audio' }, on_failure: stop })
  }

  return {
    get playing() { return playing },
    toggle,
  }
}
