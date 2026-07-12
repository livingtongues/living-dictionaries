import { writable } from 'svelte/store'
import type { Readable } from 'svelte/store'
import { api_gcs_serving_url } from '$api/gcs_serving_url/_call'
import { api_upload } from '$api/upload/_call'
import { DEV_LOCAL_PREFIX } from '$lib/utils/media-url'

export type MediaKind = 'image' | 'audio' | 'video'

export interface MediaUploadProgress {
  /** 0-100 — capped at 99 until `done` resolves */
  progress: number
  /** object URL for a local preview while uploading (images only) */
  preview_url?: string
}

export interface MediaUploadResult {
  storage_path: string
  /** images only: lh3 hash, or a `dev-local:`-prefixed sentinel in dev */
  serving_url?: string
}

export interface MediaUploadHandle {
  /** progress ONLY — success/failure flow through `done` */
  progress: Readable<MediaUploadProgress>
  /** resolves with the landed paths; REJECTS on presign error, non-2xx PUT, network error, abort, or serving-url error */
  done: Promise<MediaUploadResult>
  abort: () => void
}

/** Presign via `api_upload` → XHR PUT with progress → (images only: fetch the lh3 serving URL). */
export function upload_media({ file, folder, dictionary_id, kind }: {
  file: File | Blob
  /** full storage folder including the dictionary id prefix, e.g. `${dictionary_id}/images/${sense_id}` */
  folder: string
  dictionary_id: string
  kind: MediaKind
}): MediaUploadHandle {
  const preview_url = kind === 'image' ? URL.createObjectURL(file) : undefined
  const { set, subscribe } = writable<MediaUploadProgress>({ progress: 0, preview_url })

  let xhr: XMLHttpRequest | null = null
  let aborted = false

  async function run(): Promise<MediaUploadResult> {
    // `api_upload` returns `{ data: null, error }` on failure — guard before touching `data`
    const { data: upload, error } = await api_upload({ folder, dictionary_id, file_name: derive_file_name({ file, kind }), file_type: file.type })
    if (error || !upload)
      throw new Error(error?.message ?? 'Upload failed.')
    if (aborted)
      throw new Error('Upload aborted.')

    const { presigned_upload_url, bucket, object_key, dev_mock } = upload
    xhr = new XMLHttpRequest()
    await put_file({ xhr, file, url: presigned_upload_url, on_progress: progress => set({ progress: Math.min(progress, 99), preview_url }) })

    if (kind !== 'image') {
      set({ progress: 100, preview_url })
      return { storage_path: object_key }
    }

    // Dev media mock: bytes were stored locally; skip the (unconfigured)
    // serving-url service and point at the local store via a sentinel.
    if (dev_mock) {
      set({ progress: 100, preview_url })
      return { storage_path: object_key, serving_url: `${DEV_LOCAL_PREFIX}${object_key}` }
    }

    const { data, error: serving_url_error } = await api_gcs_serving_url({ storage_path: `${bucket}/${object_key}` })
    if (serving_url_error || !data)
      throw new Error(serving_url_error?.message ?? 'Failed to get image serving URL.')
    set({ progress: 100, preview_url })
    return { storage_path: object_key, serving_url: data.serving_url }
  }

  const done = run()
  // log + mark the rejection handled for callers that ignore `done`; awaiting callers still get it
  done.catch((err: unknown) => console.error(err))

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

function put_file({ xhr, file, url, on_progress }: {
  xhr: XMLHttpRequest
  file: File | Blob
  url: string
  on_progress: (progress: number) => void
}): Promise<void> {
  return new Promise((resolve, reject) => {
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable)
        on_progress(Math.round((event.loaded / event.total) * 100))
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300)
        resolve()
      else
        reject(new Error(`Failed to upload file (status ${xhr.status}).`))
    })

    xhr.addEventListener('error', () => reject(new Error('Failed to upload file.')))
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted.')))

    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.send(file)
  })
}
