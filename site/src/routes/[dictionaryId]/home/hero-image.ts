import type { Readable } from 'svelte/store'
import type { ImageUploadStatus } from '$lib/components/image/upload-image'
import type { TablesUpdate } from '$lib/types'
import { upload_image } from '$lib/components/image/upload-image'
import { page } from '$app/state'

const TEN_MB = 10_485_760

/**
 * Validate + upload a hero cover image, then persist it to the dictionary
 * catalog. Returns the upload status store for the progress overlay, or null
 * when the file fails validation (alerted). Same validation as ImageDropZone.
 */
export function upload_cover_image({ file, dictionary_id, update_dictionary, on_saved }: {
  file: File
  dictionary_id: string
  update_dictionary: (change: TablesUpdate<'dictionaries'>) => Promise<void>
  on_saved: () => void
}): Readable<ImageUploadStatus> | null {
  if (file.type.split('/')[0] !== 'image' || file.type === 'image/svg+xml') {
    alert(page.data.t('upload.error'))
    return null
  }
  if (file.size > TEN_MB) {
    alert(`${page.data.t('upload.file_must_be_smaller')} 10MB`)
    return null
  }

  const status = upload_image({ file, folder: `${dictionary_id}/featured_images` })
  const unsubscribe = status.subscribe(({ storage_path, serving_url }) => {
    if (storage_path && serving_url) {
      update_dictionary({ featured_image: { storage_path, serving_url } })
        .then(on_saved)
        .catch(err => alert(`${page.data.t('misc.error')}: ${err}`))
      unsubscribe()
    }
  })
  return status
}
