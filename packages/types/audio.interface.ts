// current interface used across the site that we will migrate from this to just ExpandedAudio
export type IAudio = ExpandedAudio & ActualDatabaseAudio

export interface ExpandedAudio {
  fb_storage_path: string
  storage_url: string
  uid_added_by?: string
  timestamp?: Date
  speaker_ids?: string[]
  source?: string
  playing?: boolean // true when audio is being played
  speakerName?: string // old Talking Dictionaries write-in
}

export type ActualDatabaseAudio = Omit<GoalDatabaseAudio, 'sp'> & DeprecatedAudio

export interface GoalDatabaseAudio {
  path: string // Firebase Storage location
  ab?: string // added by uid
  ts?: number // timestamp in milliseconds, Firestore Timestamps not supported inside arrays
  sp?: string[] // id of speakers
  sc?: string // source // TODO fix inconsistency w/ "sc" here vs "sr" in entry
  speakerName?: string // old Talking Dictionaries - can be deprecated if we create new speakers with IDs from these names
}

interface DeprecatedAudio {
  sp?: string // id of speaker
  uploadedBy?: string
  uploadedAt?: any
  source?: string
  previousFileName?: string // put into metadata
  size?: number // put into metadata
  mt?: string // media-token deprecated after updating storage security rules, add onto end of URL + path // WAS also url
}
