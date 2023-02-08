export interface ExpandedAudio {
  fb_storage_path: string;
  uid_added_by: string;
  timestamp?: Date;
  speaker_ids?: string[];
  source?: string;
  playing?: boolean; // true when audio is being played
}

export interface DatabaseAudio extends Omit<IAudio, 'sp'> {
  sp?: string[]; // id of speakers
}

export interface IAudio extends DeprecatedAudio {
  path: string; // Firebase Storage location
  ts?: any; // timestamp - need to determine type, had some trouble with Firestore Timestamps previously maybe? Might need to settle for a number timestamp
  ab?: string; // added by uid
  sp?: string; // id of speaker
  sc?: string; // source
}

export interface DeprecatedAudio {
  uploadedAt?: any;
  uploadedBy?: string;
  speakerName?: string; // for old Talking Dictionaries
  source?: string;
  previousFileName?: string; // put into metadata
  size?: number; // put into metadata
  mt: string; // media-token deprecated after updating storage security rules, add onto end of URL + path // WAS also url
}
