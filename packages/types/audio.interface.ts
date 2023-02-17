// current interface used across the site that we will migrate from this to just ExpandedAudio
export type IAudio = ExpandedAudio & ActualDatabaseAudio;

export interface ExpandedAudio {
  fb_storage_path: string;
  uid_added_by?: string;
  timestamp?: Date; // converted from number, Date, or Firestore Timestamp
  speaker_ids?: string[];
  source?: string;
  playing?: boolean; // true when audio is being played
  speakerName?: string; // old Talking Dictionaries
}

export type ActualDatabaseAudio = Omit<GoalDatabaseAudio, 'sp'> & DeprecatedAudio;

export interface GoalDatabaseAudio {
  path: string; // Firebase Storage location
  ab?: string; // added by uid
  ts?: any; // timestamp - need to determine type, had some trouble with Firestore Timestamps previously maybe? Might need to settle for a number timestamp
  sp?: string[]; // id of speakers
  sc?: string; // source
  speakerName?: string; // old Talking Dictionaries - can be deprecated if we create new speakers with IDs from these names
}

interface DeprecatedAudio {
  sp?: string; // id of speaker
  uploadedBy?: string;
  uploadedAt?: any;
  source?: string;
  previousFileName?: string; // put into metadata
  size?: number; // put into metadata
  mt?: string; // media-token deprecated after updating storage security rules, add onto end of URL + path // WAS also url
}
