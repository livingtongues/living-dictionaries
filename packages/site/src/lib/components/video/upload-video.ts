import { type Readable, get, writable } from 'svelte/store'
import { page } from '$app/stores'
import { api_upload } from '$api/upload/_call'

export interface VideoUploadStatus {
  progress: number
  error?: string
  storage_path?: string
}

export function upload_video({ file, folder }: { file: File | Blob, folder: string }): Readable<VideoUploadStatus> {
  const { set, subscribe } = writable<VideoUploadStatus>({ progress: 0 });

  (async () => {
    const is_blob = file instanceof Blob && !(file instanceof File)
    const [extension] = file.type.split('/')[1].split(';') // turns 'video/webm;codecs=vp8,opus' to 'webm' and 'video/mp4' to 'mp4'
    const file_name = is_blob ? `video.${extension}` : file.name
    const { data: { dictionary } } = get(page)
    const { data: { presigned_upload_url, object_key }, error } = await api_upload({ folder, dictionary_id: dictionary.id, file_name, file_type: file.type })
    if (error) {
      console.error(error)
      set({ progress: 0, error: error.message })
    }

    await upload_file(file, presigned_upload_url)

    set({ progress: 100, storage_path: object_key })
  })()

  function upload_file(file: File | Blob, url: string) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      console.info({ file, url })

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          console.info(`Upload progress: ${progress}%`)
          set({ progress })
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          set({ progress: 99 })
          resolve(xhr.response)
        } else {
          set({ progress: 0, error: 'Failed to upload file.' })
        }
      })

      xhr.addEventListener('error', () => {
        set({ progress: 0, error: 'Failed to upload file.' })
        reject(xhr.statusText)
      })

      xhr.open('PUT', url)
      xhr.setRequestHeader('Content-Type', file.type)
      xhr.send(file)
    })
  }

  return { subscribe }
}
