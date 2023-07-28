import type { ActualDatabaseEntry } from './entry.interface';

export type AlgoliaEntry = Omit<ActualDatabaseEntry, 'ua' | 'ca'> & LDAlgoliaFields;

export interface LDAlgoliaFields {
  objectID?: string; // Algolia object id = entry id
  dictId?: string; // dictionary Id entry belongs to, to filter search results by dictionary
  _highlightResult?: any;

  hasImage?: boolean;
  hasAudio?: boolean;
  hasVideo?: boolean;
  hasSpeaker?: boolean;
  hasSemanticDomain?: boolean;
  hasPartOfSpeech?: boolean;
  hasNounClass?: boolean;
  hasPluralForm?: boolean;

  ua?: number; // in seconds
  ca?: number; // in seconds
}

// media timestamps needs converted to a timestamp usable by Algolia
// only need gcs value of photos
// need path and speakerName value for audio - pull from speakerId on import to Algolia 