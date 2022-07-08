import type { IGloss } from './gloss.interface';
import type { IAudio } from './audio.interface';
import type { IPhoto } from './photo.interface';
import type { IVideo } from './video.interface';
import type { IExampleSentence } from './exampe-sentence.interface';
// import type { Hit } from 'instantsearch.js';
import type { Timestamp } from 'firebase/firestore';

import type { IFirestoreMetaDataAbbreviated } from 'sveltefirets';
// TODO remove deprecated fields
export interface IEntry extends IFirestoreMetaDataAbbreviated, LDAlgoliaFields, DeprecatedFields {
  // Partial<Hit>
  // Writing
  lx: string; // lexeme
  lo?: string; // Local Orthography
  lo2?: string; // Local Orthography 2
  lo3?: string; // Local Orthography 3
  lo4?: string; // Local Orthography 4
  lo5?: string; // Local Orthography 5

  // Pronunciation
  ph?: string; // phonetic

  // Meaning & Morphology
  gl: IGloss; // glosses
  in?: string; // interlinearization
  mr?: string; // morphology
  ps?: string; // part of speech
  sd?: string[]; // semantic domain strings, only using for custom semantic domains brought in from imports
  sdn?: string[]; // semantic domain number, simplified system modeled after SemDom (eg. 2.1.2.3)
  de?: string; // definition english, only in Bahasa Lani (jaRhn6MAZim4Blvr1iEv) deprecated by Greg

  // Language & entry metadata
  nc?: string; // noun class
  va?: string; // variant (currently babanki only)
  di?: string; // dialect for this entry
  nt?: string; // notes
  sr?: string[]; // Source(s)

  // Usage
  xv?: string; // example vernacular - used for old dictionary imports
  xs?: IExampleSentence; // example sentences - new format which allows us to bring in example sentences from multiple languages (vernacular and gloss languages)

  sf?: IAudio; // sound file - TODO: deprecate this and move to using array of audio files
  // sfs?: IAudio[]; // sound files
  // deletedSfs?: IAudio[];

  pf?: IPhoto; // photo file - TODO: deprecate this and move to using array of photo files
  // pfs?: IPhoto[]; // photo files
  // deletedPfs?: IPhoto[];

  vfs?: IVideo[]; // video files
  deletedVfs?: IVideo[];

  // IDs
  ii?: string; // importId which can be used to show all entries from a particular import
  ei?: string; // Elicitation Id for Munda languages or Swadesh Composite number list from Comparalex

  deletedAt?: Timestamp; // whether this entry has been deleted
}

// TODO:
// Convert deprecated fields that the database needs searched for: dialect, ab, glosses
// Add video object
// Add image attribution field

// Custom fields? - by dictionary manager or us
// 1. Dictionary manager creates custom field called "Culture"
// Anyone editing entries can add data for the "Culture" field.

// Future?
// link entries - "this entry is used in ______"
// or just a "related entries" section fueled by a search for the lexeme

interface LDAlgoliaFields {
  dictId?: string; // dictionary Id entry belongs to, to filter search results by dictionary
  _highlightResult?: any;

  hasImage?: boolean;
  hasAudio?: boolean;
  hasSpeaker?: boolean;
  hasSemanticDomain?: boolean;
  hasPartOfSpeech?: boolean;
}

interface DeprecatedFields {
  createdBy?: string;
  updatedBy?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export enum EntryCSVFields {
  lx = 'Lexeme/Word/Phrase',
  ph = 'Phonetic (IPA)',
  in = 'Interlinearization',
  nc = 'Noun class',
  mr = 'Morphology',
  di = 'Dialect',
  nt = 'Notes',
  psab = 'Part of Speech abbreviation',
  ps = 'Part of Speech',
  sr = 'Source(s)',
  id = 'Entry Id',
}

export type EntryForCSV = keyof typeof EntryCSVFields;

