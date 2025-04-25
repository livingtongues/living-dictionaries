import { type Readable, get, writable } from 'svelte/store'
import { api_gcs_serving_url } from '$api/gcs_serving_url/_call'
import { api_upload } from '$api/upload/_call'
import { page } from '$app/stores'

export interface ImageUploadStatus {
  progress: number
  preview_url: string
  error?: string
  storage_path?: string
  serving_url?: string
}

export function upload_image({
  file,
  folder,
  on_success,
}: {
  file: File
  folder: string
  on_success?: () => void
}): Readable<ImageUploadStatus> {
  const preview_url = URL.createObjectURL(file)
  const { set, subscribe } = writable<ImageUploadStatus>({ progress: 0, preview_url });

  (async () => {
    const { data: { dictionary } } = get(page)
    const { data: { presigned_upload_url, bucket, object_key }, error } = await api_upload({ folder, dictionary_id: dictionary.id, file_name: file.name, file_type: file.type })
    if (error) {
      console.error(error)
      set({ preview_url, progress: 0, error: error.message })
    } else {
      await upload_file(file, presigned_upload_url)

      const { data, error: serving_url_error } = await api_gcs_serving_url({ storage_path: `${bucket}/${object_key}` })

      if (serving_url_error) {
        console.error(serving_url_error)
        set({ preview_url, progress: 0, error: serving_url_error.message })
      }

      if (data) {
        set({ preview_url, progress: 100, storage_path: object_key, serving_url: data.serving_url })
        on_success?.()
      }
    }
  })()

  function upload_file(file: File, url: string) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      console.info({ file, url })

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          console.info(`Upload progress: ${progress}%`)
          set({ preview_url, progress: Math.min(progress, 99) })
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          set({ preview_url, progress: 99 })
          resolve(xhr.response)
        } else {
          set({ preview_url, progress: 0, error: 'Failed to upload file.' })
        }
      })

      xhr.addEventListener('error', () => {
        set({ preview_url, progress: 0, error: 'Failed to upload file.' })
        reject(xhr.statusText)
      })

      xhr.open('PUT', url)
      xhr.setRequestHeader('Content-Type', file.type)
      xhr.send(file)
    })
  }

  return { subscribe }
}
