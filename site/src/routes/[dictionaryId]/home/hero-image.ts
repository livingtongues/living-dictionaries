import type { MediaUploadHandle } from '$lib/media/upload-media'
import type { TablesUpdate } from '$lib/types'
import { upload_media } from '$lib/media/upload-media'
import { page } from '$app/state'

const TEN_MB = 10_485_760

/**
 * Validate + upload a hero cover image, then persist it to the dictionary
 * catalog. Returns the upload handle for the progress overlay (`done` includes
 * the catalog save — errors render in the overlay), or null when the file
 * fails validation (alerted). Same validation as ImageDropZone.
 */
export function upload_cover_image({ file, dictionary_id, update_dictionary, on_saved }: {
  file: File
  dictionary_id: string
  update_dictionary: (change: TablesUpdate<'dictionaries'>) => Promise<void>
  on_saved: () => void
}): MediaUploadHandle | null {
  if (file.type.split('/')[0] !== 'image' || file.type === 'image/svg+xml') {
    alert(page.data.t('upload.error'))
    return null
  }
  if (file.size > TEN_MB) {
    alert(`${page.data.t('upload.file_must_be_smaller')} 10MB`)
    return null
  }

  // Not a photos row — a fresh uuid keys the R2 object (`{dict}/photo/{uuid}.{ext}`).
  const handle = upload_media({ file, dictionary_id, kind: 'image', media_id: crypto.randomUUID() })
  const done = handle.done.then(async ({ storage_path }) => {
    await update_dictionary({ featured_image: { storage_path, serving_url: '' } })
    on_saved()
    return { storage_path }
  })
  done.catch(() => undefined) // error renders in the hero overlay
  return { ...handle, done }
}
