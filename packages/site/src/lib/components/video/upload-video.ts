import { getStorage, ref, uploadBytesResumable } from 'firebase/storage'
import { type Readable, get, writable } from 'svelte/store'
import type { VideoCustomMetadata } from '@living-dictionaries/types'
import { page } from '$app/stores'

export interface VideoUploadStatus {
  progress: number
  error?: string
  storage_path?: string
}

export function upload_video({ file, folder }: { file: File | Blob, folder: string }): Readable<VideoUploadStatus> {
  const { set, subscribe } = writable<VideoUploadStatus>({ progress: 0 })
  const [fileTypeSuffix] = file.type.split('/')[1].split(';') // turns 'video/webm;codecs=vp8,opus' to 'webm' and 'video/mp4' to 'mp4'
  const storage_path = `${folder}/${new Date().getTime()}.${fileTypeSuffix}`
  const { data: { user } } = get(page)
  const $user = get(user)
  const customMetadata: VideoCustomMetadata & Record<string, string> = {
    uploadedByUid: $user.uid,
    uploadedByName: $user.displayName,
    // @ts-ignore
    originalFileName: file.name,
  }
  // https://firebase.google.com/docs/storage/web/upload-files
  const storage = getStorage()
  const videoRef = ref(storage, storage_path)
  const uploadTask = uploadBytesResumable(videoRef, file, { customMetadata })

  uploadTask.on(
    'state_changed',
    (snapshot) => {
      const decimal_based_percentage = snapshot.bytesTransferred / snapshot.totalBytes
      const progress = Math.floor(decimal_based_percentage * 100)
      console.info(`Upload is ${progress}% done`)
      set({ progress })

      switch (snapshot.state) {
        case 'paused':
          console.info('Upload is paused')
          break
        case 'running':
          console.info('Upload is running')
          break
      }
    },
    // https://firebase.google.com/docs/storage/web/handle-errors
    (err) => {
      console.error(err)
      set({ progress: 0, error: err.message })
    },
    () => {
      set({ progress: 100, storage_path })
    },
  )

  return { subscribe }
}
