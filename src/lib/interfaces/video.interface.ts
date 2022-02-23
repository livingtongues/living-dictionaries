export interface IVideo {
  path: string; // Firebase Storage location
  // length?: number; // Length in milliseconds
  ts?: Date; // timestamp
  ab?: string; // added by uid
  sp?: string; // id of speaker
  youtubeId?: string;
  vimeoId?: string;
  deleted?: Date;
}

export interface IVideoCustomMetadata {
  uploadedByUid: string;
  uploadedByName: string;
  // deleted?: string; // Date.now().toString();
}
