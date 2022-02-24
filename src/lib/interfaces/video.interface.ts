import type { Timestamp } from 'firebase/firestore';

export interface IVideo {
  path?: string; // Firebase Storage location
  // length?: number; // Length in milliseconds
  ab?: string; // added by uid
  sp?: string; // id of speaker
  youtubeId?: string;
  vimeoId?: string;
  ts?: number; // timestamp in milliseconds
  deleted?: number; // timestamp in milliseconds
}

export interface IVideoCustomMetadata {
  uploadedByUid: string;
  uploadedByName: string;
  // deleted?: string; // Date.now().toString();
}
