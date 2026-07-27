import { log_warning } from '$lib/debug/remote-log'

/**
 * Start playback and NAME the failure when it doesn't start.
 *
 * `HTMLMediaElement.play()` returns a promise. A rejected one is invisible to the
 * element's `onerror` handler, so every `void audio.play()` in this codebase used
 * to do two bad things at once: emit a bare `unhandled_rejection` with no url, no
 * error name and no readyState, and leave the UI claiming to be playing. Four
 * real visitors on 2026-07-26 tapped play 3–7 times each and got silence, and the
 * telemetry could not say why — every file they asked for serves fine over HTTP.
 *
 * `on_failure` is where the caller puts its own truth-restoring work (clear the
 * playing flag, toast the user). Keep it synchronous and cheap.
 */
export function play_audio_element({ audio, context, on_failure }: {
  audio: HTMLAudioElement
  /** Whatever identifies this playback — dictionary_id / entry_id / audio_id / storage_path / surface. */
  context: Record<string, unknown>
  on_failure?: () => void
}): void {
  audio.play().catch((error) => {
    log_warning({
      message: 'audio_play_failed',
      context: {
        ...context,
        url: audio.currentSrc || audio.src || null,
        error_name: (error as Error)?.name ?? null,
        error_message: (error as Error)?.message ?? String(error),
        media_error_code: audio.error?.code ?? null,
        ready_state: audio.readyState,
        network_state: audio.networkState,
        online: typeof navigator !== 'undefined' ? navigator.onLine : null,
      },
    })
    on_failure?.()
  })
}
