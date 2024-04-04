import type { Timestamp } from 'firebase/firestore'

// current interface used across the site that we will migrate from this to just ExpandedPhoto
export type IPhoto = ExpandedPhoto & ActualDatabasePhoto

export interface ExpandedPhoto {
  fb_storage_path: string
  storage_url: string
  specifiable_image_url?: string // Google's Magic Image serving url reference which accepts requests for exact image size https://medium.com/google-cloud/uploading-resizing-and-serving-images-with-google-cloud-platform-ca9631a2c556
  uid_added_by: string
  timestamp?: Date
  source?: string
  photographer_credit?: string
}

export type ActualDatabasePhoto = GoalDatabasePhoto & DeprecatedPhoto

export interface GoalDatabasePhoto {
  path?: string // Firebase storage location
  gcs?: string // Google's Magic Image serving url reference which accepts requests for exact image size https://medium.com/google-cloud/uploading-resizing-and-serving-images-with-google-cloud-platform-ca9631a2c556
  ab?: string // added by uid
  ts?: number // timestamp in milliseconds, Firestore Timestamps not supported inside arrays
  cr?: string // credit: photographer name
  sc?: string // source
}

interface DeprecatedPhoto {
  uploadedBy?: string
  uploadedAt?: any
  source?: string
}

export interface DictionaryPhoto extends Omit<ExpandedPhoto, 'timestamp' | 'storage_url'> {
  timestamp?: Date | Timestamp
}

export interface PartnerPhoto {
  fb_storage_path: string
  specifiable_image_url?: string
}
