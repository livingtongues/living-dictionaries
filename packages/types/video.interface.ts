export interface ExpandedVideo {
  fb_storage_path: string;
  uid_added_by: string;
  timestamp?: Date;
  speaker_ids?: string[];
  source?: string;
  youtubeId?: string;
  vimeoId?: string;
}

export interface DatabaseVideo extends Omit<IVideo, 'sp'> {
  sp?: string[]; // id of speakers
}

export interface IVideo {
  path?: string; // Firebase Storage location
  // length?: number; // Length in milliseconds
  ab?: string; // added by uid
  sp?: string; // id of speaker o
  youtubeId?: string;
  vimeoId?: string;
  ts?: number; // timestamp in milliseconds
  deleted?: number; // timestamp in milliseconds
  startAt?: number;
}

export interface IVideoCustomMetadata {
  uploadedByUid: string;
  uploadedByName: string;
  // deleted?: string; // Date.now().toString();
}
