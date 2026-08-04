import { play_audio_element } from '$lib/media/play-audio-element'
import { audio_element_from_storage_path } from '$lib/utils/media-url'
import { toast } from '$lib/state/toast.svelte'

/**
 * ONE exclusive entry-pronunciation player for every surface (list, table,
 * gallery, home cards, entry detail). Active state is keyed by `audio.id` —
 * never by URL comparison — and playback always goes through
 * `audio_element_from_storage_path` so the `_p1.mp3` derivative → original
 * fallback chain applies (the old per-surface players bypassed it).
 */

let active_audio_id = $state<string | null>(null)
let current_element: HTMLAudioElement | null = null

function clear_if_active(audio_id: string) {
  if (active_audio_id === audio_id)
    active_audio_id = null
}

function stop() {
  current_element?.pause()
  current_element = null
  active_audio_id = null
}

export interface EntryAudioPlayRequest {
  audio_id: string
  storage_path: string
  /** Identifies this playback in telemetry: dictionary_id / entry_id / context. */
  context: Record<string, unknown>
  failure_message: string
}

function play({ audio_id, storage_path, context, failure_message }: EntryAudioPlayRequest) {
  current_element?.pause()
  const audio = audio_element_from_storage_path(storage_path)
  current_element = audio
  active_audio_id = audio_id

  audio.addEventListener('ended', () => clear_if_active(audio_id))
  play_audio_element({
    audio,
    context: { surface: 'entry_audio', audio_id, storage_path, ...context },
    on_failure: () => {
      // Say something. A silent failed tap is why these visitors tapped five times.
      toast.error(failure_message)
      clear_if_active(audio_id)
    },
  })
}

/** Play the requested recording if it isn't the active one; stop it if it is. */
function toggle(request: EntryAudioPlayRequest) {
  if (active_audio_id === request.audio_id) {
    stop()
    return
  }
  play(request)
}

export const entry_audio = {
  get active_audio_id() { return active_audio_id },
  is_active(audio_id: string | undefined | null) { return !!audio_id && active_audio_id === audio_id },
  play,
  toggle,
  stop,
}
