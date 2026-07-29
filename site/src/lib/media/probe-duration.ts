/**
 * Best-effort browser decode of an audio/video file's playback duration before
 * upload (seeds the media ledger's `duration_ms`; the server-side media sweep
 * probes anything we can't decode here). Never throws, never blocks an upload:
 * undecodable/timeout/Infinity (MediaRecorder webm) all resolve to null.
 */
export function probe_media_duration_ms({ file, kind, timeout_ms = 3000 }: {
  file: File | Blob
  kind: 'audio' | 'video'
  timeout_ms?: number
}): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const element = document.createElement(kind)
    let settled = false
    const settle = (duration_ms: number | null) => {
      if (settled)
        return
      settled = true
      clearTimeout(timer)
      element.removeAttribute('src')
      URL.revokeObjectURL(url)
      resolve(duration_ms)
    }
    const timer = setTimeout(() => settle(null), timeout_ms)
    element.preload = 'metadata'
    element.addEventListener('loadedmetadata', () => {
      const { duration } = element
      settle(Number.isFinite(duration) && duration > 0 ? Math.round(duration * 1000) : null)
    })
    element.addEventListener('error', () => settle(null))
    element.src = url
  })
}
