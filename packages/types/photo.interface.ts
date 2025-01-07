import type { Timestamp } from 'firebase/firestore'

export interface DictionaryPhoto {
  fb_storage_path: string
  specifiable_image_url: string // Google's Magic Image serving url reference which accepts requests for exact image size https://medium.com/google-cloud/uploading-resizing-and-serving-images-with-google-cloud-platform-ca9631a2c556
  uid_added_by: string
  timestamp?: Date | Timestamp
}

export interface PartnerPhoto {
  fb_storage_path: string
  specifiable_image_url?: string
}
