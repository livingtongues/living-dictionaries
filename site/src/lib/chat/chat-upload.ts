import type { ChatUploadCommitFile } from '$api/chat/upload/commit/_call'
import { api_chat_upload_presign } from '$api/chat/upload/presign/_call'

/**
 * Client half of the two-step chat attachment upload: presign → PUT the bytes
 * straight to R2 → (caller posts the message) → commit.
 *
 * Uses **XHR, not fetch**, for the PUT: fetch still has no upload-progress
 * event, and these files are large enough (up to 500 MB) that a silent
 * multi-minute wait is not an acceptable UI. XHR also gives us a real `abort()`
 * for cancel.
 */

export interface UploadProgress {
  /** Index into the `files` array passed to `upload_files`. */
  index: number
  filename: string
  mimetype: string
  bytes_sent: number
  bytes_total: number
  /** 0–1. */
  fraction: number
  /** Bytes/second over the whole upload so far; null before the first sample. */
  bytes_per_second: number | null
  /** Seconds remaining at the current average rate; null when not yet estimable. */
  seconds_remaining: number | null
  status: 'waiting' | 'uploading' | 'done' | 'error' | 'cancelled'
  error_message?: string
}

export interface UploadHandle {
  /** Resolves with the uploads to commit — only the ones whose bytes actually landed. */
  done: Promise<ChatUploadCommitFile[]>
  /** Abort every in-flight and pending PUT. */
  cancel: () => void
}

function put_with_progress({ url, file, on_progress, register_abort }: {
  url: string
  file: File
  on_progress: (bytes_sent: number) => void
  register_abort: (abort: () => void) => void
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    register_abort(() => request.abort())
    request.open('PUT', url, true)
    // R2 verifies this against the signed ContentType; the browser sets
    // Content-Length itself and refuses to let us touch it.
    request.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable)
        on_progress(event.loaded)
    })
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) {
        on_progress(file.size)
        resolve()
      } else {
        reject(new Error(`Upload failed (${request.status})`))
      }
    })
    request.addEventListener('error', () => reject(new Error('Network error during upload')))
    request.addEventListener('abort', () => reject(new DOMException('Upload cancelled', 'AbortError')))
    request.send(file)
  })
}

/**
 * Presigns and uploads every file, reporting progress per file. Files upload
 * SEQUENTIALLY: a browser will happily saturate an uplink with parallel PUTs,
 * which makes every individual progress bar crawl and makes the whole batch
 * finish later than doing them one at a time.
 */
export function upload_files({ room_id, files, on_progress }: {
  room_id: string
  files: File[]
  on_progress: (progress: UploadProgress[]) => void
}): UploadHandle {
  const state: UploadProgress[] = files.map((file, index) => ({
    index,
    filename: file.name,
    mimetype: file.type || 'application/octet-stream',
    bytes_sent: 0,
    bytes_total: file.size,
    fraction: 0,
    bytes_per_second: null,
    seconds_remaining: null,
    status: 'waiting',
  }))

  let cancelled = false
  let abort_current: (() => void) | null = null

  function emit() {
    on_progress(state.map(entry => ({ ...entry })))
  }

  function fail_all(message: string) {
    for (const entry of state) {
      if (entry.status === 'waiting' || entry.status === 'uploading') {
        entry.status = 'error'
        entry.error_message = message
      }
    }
    emit()
  }

  const done = (async (): Promise<ChatUploadCommitFile[]> => {
    emit()

    const { data, error } = await api_chat_upload_presign({
      room_id,
      files: files.map(file => ({
        filename: file.name,
        mimetype: file.type || 'application/octet-stream',
        size_bytes: file.size,
      })),
    })
    if (error || !data) {
      fail_all(error?.message ?? 'Could not start the upload')
      return []
    }

    const committable: ChatUploadCommitFile[] = []
    for (const [index, upload] of data.uploads.entries()) {
      if (cancelled)
        break
      const file = files[index]
      const entry = state[index]
      entry.status = 'uploading'
      emit()

      const started_at = performance.now()
      try {
        await put_with_progress({
          url: upload.upload_url,
          file,
          register_abort: (abort) => { abort_current = abort },
          on_progress: (bytes_sent) => {
            entry.bytes_sent = bytes_sent
            entry.fraction = entry.bytes_total ? bytes_sent / entry.bytes_total : 0
            const elapsed_seconds = (performance.now() - started_at) / 1000
            if (elapsed_seconds > 0.4 && bytes_sent > 0) {
              entry.bytes_per_second = bytes_sent / elapsed_seconds
              entry.seconds_remaining = (entry.bytes_total - bytes_sent) / entry.bytes_per_second
            }
            emit()
          },
        })
        entry.status = 'done'
        entry.fraction = 1
        entry.seconds_remaining = 0
        emit()
        committable.push({ storage_key: upload.storage_key, filename: upload.filename, mimetype: upload.mimetype })
      } catch (err) {
        const is_abort = err instanceof DOMException && err.name === 'AbortError'
        entry.status = is_abort ? 'cancelled' : 'error'
        entry.error_message = is_abort ? undefined : (err as Error).message
        emit()
        if (is_abort)
          break
      } finally {
        abort_current = null
      }
    }
    return committable
  })()

  return {
    done,
    cancel: () => {
      cancelled = true
      abort_current?.()
      for (const entry of state) {
        if (entry.status === 'waiting')
          entry.status = 'cancelled'
      }
      emit()
    },
  }
}

/** `1.2 MB/s` — null rate renders empty so the UI can drop it before the first sample. */
export function format_rate(bytes_per_second: number | null): string {
  if (!bytes_per_second)
    return ''
  if (bytes_per_second >= 1024 * 1024)
    return `${(bytes_per_second / 1024 / 1024).toFixed(1)} MB/s`
  return `${Math.round(bytes_per_second / 1024)} KB/s`
}

/** `3m 20s left` / `12s left`. */
export function format_time_remaining(seconds_remaining: number | null): string {
  if (seconds_remaining === null || !Number.isFinite(seconds_remaining))
    return ''
  const seconds = Math.max(Math.round(seconds_remaining), 0)
  if (seconds < 60)
    return `${seconds}s left`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60)
    return `${minutes}m ${seconds % 60}s left`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m left`
}

/** Batch roll-up for the single headline bar shown above the composer. */
export function overall_progress(entries: UploadProgress[]): { fraction: number, bytes_sent: number, bytes_total: number, active: boolean } {
  const bytes_total = entries.reduce((sum, entry) => sum + entry.bytes_total, 0)
  const bytes_sent = entries.reduce((sum, entry) => sum + entry.bytes_sent, 0)
  return {
    fraction: bytes_total ? bytes_sent / bytes_total : 0,
    bytes_sent,
    bytes_total,
    active: entries.some(entry => entry.status === 'uploading' || entry.status === 'waiting'),
  }
}

if (import.meta.vitest) {
  describe(format_rate, () => {
    it('formats KB/s and MB/s', () => {
      expect(format_rate(null)).toBe('')
      expect(format_rate(51200)).toBe('50 KB/s')
      expect(format_rate(3 * 1024 * 1024)).toBe('3.0 MB/s')
    })
  })

  describe(format_time_remaining, () => {
    it('formats seconds, minutes and hours', () => {
      expect(format_time_remaining(null)).toBe('')
      expect(format_time_remaining(12.4)).toBe('12s left')
      expect(format_time_remaining(200)).toBe('3m 20s left')
      expect(format_time_remaining(3700)).toBe('1h 1m left')
    })
  })

  describe(overall_progress, () => {
    it('rolls a batch up into one fraction', () => {
      const entries: UploadProgress[] = [
        { index: 0, filename: 'a', mimetype: 'video/mp4', bytes_sent: 100, bytes_total: 100, fraction: 1, bytes_per_second: null, seconds_remaining: null, status: 'done' },
        { index: 1, filename: 'b', mimetype: 'image/jpeg', bytes_sent: 100, bytes_total: 300, fraction: 0.33, bytes_per_second: null, seconds_remaining: null, status: 'uploading' },
      ]
      expect(overall_progress(entries)).toEqual({ fraction: 0.5, bytes_sent: 200, bytes_total: 400, active: true })
    })
  })
}
