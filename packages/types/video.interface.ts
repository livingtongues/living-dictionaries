// current interface used across the site that we will migrate from this to just ExpandedVideo
export type IVideo = ExpandedVideo & ActualDatabaseVideo

export interface ExpandedVideo {
  fb_storage_path: string
  storage_url: string
  uid_added_by: string
  timestamp?: Date
  speaker_ids?: string[]
  source?: string
  youtubeId?: string
  vimeoId?: string
  start_at_seconds?: number
}

export type ActualDatabaseVideo = Omit<GoalDatabaseVideo, 'sp'> & DeprecatedVideo

export interface GoalDatabaseVideo {
  path?: string // Firebase Storage location
  ab?: string // added by uid
  ts?: number // timestamp in milliseconds, Firestore Timestamps not supported inside arrays
  sp?: string[] // id of speakers
  sc?: string // source
  youtubeId?: string
  vimeoId?: string
  deleted?: number // timestamp in milliseconds
  startAt?: number
  // length?: number; // Length in milliseconds
}

interface DeprecatedVideo {
  sp?: string // id of speaker
}

///

export interface IVideoCustomMetadata {
  uploadedByUid: string
  uploadedByName: string
  // deleted?: string; // Date.now().toString();
}

export interface HostedVideo {
  type: 'youtube' | 'vimeo'
  video_id: string
  start_at_seconds?: number
}
