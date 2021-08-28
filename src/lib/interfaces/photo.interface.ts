export interface IPhoto {
  id?: string;
  path?: string; // Firebase storage location
  gcs: string; // Google's Magic Image serving url (not storage location, but a reference which accepts requests for exact image size)
  // See https://medium.com/google-cloud/uploading-resizing-and-serving-images-with-google-cloud-platform-ca9631a2c556
  ts?: any; // timestamp // WAS uploadedAt
  ab?: string; // added by uid // WAS uploadedBy
  cr?: string; // photographer name // not yet implemented
  sc?: string; // source
  source?: string; // deprecated
}
