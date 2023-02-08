export interface ExpandedPhoto {
  fb_storage_path: string;
  specifiable_image_url?: string; // Google's Magic Image serving url reference which accepts requests for exact image size https://medium.com/google-cloud/uploading-resizing-and-serving-images-with-google-cloud-platform-ca9631a2c556
  uid_added_by: string;
  timestamp?: Date;
  source?: string;
  photographer_credit: string;
}

export type DatabasePhoto = IPhoto;

export interface IPhoto extends DeprecatedPhoto {
  path?: string; // Firebase storage location
  gcs: string; // Google's Magic Image serving url reference which accepts requests for exact image size https://medium.com/google-cloud/uploading-resizing-and-serving-images-with-google-cloud-platform-ca9631a2c556
  ts?: any; // timestamp - need to determine type, had some trouble with Firestore Timestamps previously maybe? Might need to settle for a number timestamp
  ab?: string; // added by uid
  cr?: string; // credit: photographer name
  sc?: string; // source
}

export interface DeprecatedPhoto {
  uploadedAt?: any;
  uploadedBy?: string;
  id?: string;
  source?: string;
}