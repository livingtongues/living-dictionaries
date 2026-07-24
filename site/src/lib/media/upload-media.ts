import { writable } from 'svelte/store'
import type { Readable } from 'svelte/store'
import type { PhotoUploadResponseBody } from '../../routes/api/photo-upload/+server'
import type { PhotoExif } from './photo-coords'
import { api_upload } from '$api/upload/_call'
import { log_event } from '$lib/debug/remote-log'
import { prepare_image_upload } from './prepare-image-upload'

export type MediaKind = 'image' | 'audio' | 'video'

export interface MediaUploadProgress {
  /** 0-100 — capped at 99 until `done` resolves */
  progress: number
  /** object URL for a local preview while uploading (images only) */
  preview_url?: string
}

export interface MediaUploadResult {
  storage_path: string
  /** Images only — EXIF-derived, blunted to village level (2dp) server-side. */
  exif?: PhotoExif
}

export interface MediaUploadHandle {
  /** progress ONLY — success/failure flow through `done` */
  progress: Readable<MediaUploadProgress>
  /** resolves with the landed path; REJECTS on presign error, non-2xx PUT/POST, network error, or abort */
  done: Promise<MediaUploadResult>
  abort: () => void
}

/**
 * All media lands on the R2 key convention `{dict}/{kind}/{media_id}.{ext}` —
 * the caller mints the media row uuid BEFORE upload. Audio/video: presign via
 * `api_upload` → XHR PUT. Images: XHR POST of the bytes to `/api/photo-upload`
 * (the server stores the original, responds fast, and generates WebP variants
 * after the response). No serving_url anywhere — rendering derives urls from
 * `storage_path` (`photo_src` / `url_from_storage_path`).
 */
export function upload_media({ file, dictionary_id, kind, media_id }: {
  file: File | Blob
  dictionary_id: string
  kind: MediaKind
  /** the pre-minted media row uuid — the R2 object key is built from it */
  media_id: string
}): MediaUploadHandle {
  const preview_url = kind === 'image' ? URL.createObjectURL(file) : undefined
  const { set, subscribe } = writable<MediaUploadProgress>({ progress: 0, preview_url })

  let xhr: XMLHttpRequest | null = null
  let aborted = false
  let stage: 'register' | 'upload' = 'register'

  async function run(): Promise<MediaUploadResult> {
    const on_progress = (progress: number) => set({ progress: Math.min(progress, 99), preview_url })

    if (kind === 'image') {
      stage = 'upload'
      // HEIC → JPEG (Safari decodes natively) + EXIF GPS/date read from the
      // ORIGINAL before conversion strips it. Never blocks the upload on failure.
      const prepared = await prepare_image_upload(file).catch(() => ({ file, exif: {} as PhotoExif }))
      const form = new FormData()
      form.set('dictionary_id', dictionary_id)
      form.set('photo_id', media_id)
      form.set('file', prepared.file instanceof File ? prepared.file : new File([prepared.file], derive_file_name({ file: prepared.file, kind })))
      if (prepared.exif.latitude !== undefined) {
        form.set('latitude', String(prepared.exif.latitude))
        form.set('longitude', String(prepared.exif.longitude))
      }
      if (prepared.exif.taken_at)
        form.set('taken_at', prepared.exif.taken_at)
      xhr = new XMLHttpRequest()
      const response = await send_xhr({ xhr, method: 'POST', url: '/api/photo-upload', body: form, on_progress })
      const { storage_path, latitude, longitude, taken_at } = JSON.parse(response) as PhotoUploadResponseBody
      set({ progress: 100, preview_url })
      return { storage_path, exif: { latitude, longitude, taken_at } }
    }

    // `api_upload` returns `{ data: null, error }` on failure — guard before touching `data`
    const { data: upload, error } = await api_upload({
      dictionary_id,
      file_name: derive_file_name({ file, kind }),
      file_type: file.type,
      file_size: file.size,
      r2_media: { kind, media_id },
    })
    if (error || !upload)
      throw new Error(error?.message ?? 'Upload failed.')
    if (aborted)
      throw new Error('Upload aborted.')

    const { presigned_upload_url, object_key } = upload
    stage = 'upload'
    xhr = new XMLHttpRequest()
    await send_xhr({ xhr, method: 'PUT', url: presigned_upload_url, body: file, content_type: file.type, on_progress })
    set({ progress: 100, preview_url })
    return { storage_path: object_key }
  }

  const done = run()
  // log + mark the rejection handled for callers that ignore `done`; awaiting callers still get it
  done.catch((err: unknown) => {
    const error = err instanceof Error ? err : new Error(String(err))
    log_event({
      level: 'error',
      message: 'media_upload_failed',
      stack: error.stack,
      context: {
        dictionary_id,
        kind,
        stage,
        status: xhr?.status ?? null,
        bytes: file.size,
        mimetype: file.type || null,
        online: typeof navigator === 'undefined' ? null : navigator.onLine,
        error_message: error.message,
      },
    })
  })

  return {
    progress: { subscribe },
    done,
    abort: () => {
      aborted = true
      xhr?.abort()
    },
  }
}

function derive_file_name({ file, kind }: { file: File | Blob, kind: MediaKind }): string {
  if (file instanceof File)
    return file.name
  const [extension] = file.type.split('/')[1].split(';') // 'video/webm;codecs=vp8,opus' → 'webm'
  return `${kind}.${extension}`
}

function send_xhr({ xhr, method, url, body, content_type, on_progress }: {
  xhr: XMLHttpRequest
  method: 'PUT' | 'POST'
  url: string
  body: File | Blob | FormData
  /** set explicitly for raw-body PUTs; FormData sets its own multipart boundary */
  content_type?: string
  on_progress: (progress: number) => void
}): Promise<string> {
  return new Promise((resolve, reject) => {
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable)
        on_progress(Math.round((event.loaded / event.total) * 100))
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300)
        resolve(xhr.responseText)
      else
        reject(new Error(`Failed to upload file (status ${xhr.status}).`))
    })

    xhr.addEventListener('error', () => reject(new Error('Failed to upload file.')))
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted.')))

    xhr.open(method, url)
    if (content_type)
      xhr.setRequestHeader('Content-Type', content_type)
    xhr.send(body)
  })
}
