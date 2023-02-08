import type { Timestamp } from 'firebase/firestore';
import type { IFirestoreMetaData, IFirestoreMetaDataAbbreviated } from 'sveltefirets';
import type { IGloss } from './gloss.interface';
import type { IExampleSentence } from './exampe-sentence.interface';
import type { DatabaseAudio, ExpandedAudio } from './audio.interface';
import type { DatabasePhoto, ExpandedPhoto } from './photo.interface';
import type { DatabaseVideo, ExpandedVideo } from './video.interface';

export interface ExpandedEntry extends IFirestoreMetaData {
  id?: string;
  lexeme?: string;
  local_orthagraphy_1?: string;
  local_orthagraphy_2?: string;
  local_orthagraphy_3?: string;
  local_orthagraphy_4?: string;
  local_orthagraphy_5?: string;
  phonetic?: string;
  glosses?: IGloss[];
  interlinearization?: string;
  morphology?: string;
  parts_of_speech?: string[];
  semantic_domains?: string[];
  definition_english?: string;
  noun_class?: string;
  plural_form?: string;
  variant?: string;
  dialect?: string;
  notes?: string;
  sources?: string[];
  sound_files?: ExpandedAudio[];
  photo_files?: ExpandedPhoto[];
  video_files?: ExpandedVideo[];
  elicitation_id?: string;
  deletedAt?: Timestamp;
}

export type DatabaseEntry = IEntry;

// This is the current interface used across the site that we will migrate from
export interface IEntry extends IFirestoreMetaDataAbbreviated, LDAlgoliaFields, DeprecatedEntry {
  lx?: string; // lexeme
  lo?: string; // local_orthography_1
  lo2?: string; // local_orthography_2
  lo3?: string; // local_orthography_3
  lo4?: string; // local_orthography_4
  lo5?: string; // local_orthography_5
  ph?: string; // phonetic

  // Meaning & Morphology
  gl?: IGloss; // glosses
  in?: string; // interlinearization
  mr?: string; // morphology
  ps?: string[]; // parts_of_speech
  sd?: string[]; // semantic domain strings, only using for custom semantic domains brought in from imports
  sdn?: string[]; // semantic domain number, simplified system modeled after SemDom (eg. 2.1.2.3)
  de?: string; // definition_english, only in Bahasa Lani (jaRhn6MAZim4Blvr1iEv) deprecated by Greg

  // Language & entry metadata
  nc?: string; // noun_class
  pl?: string; // plural_form
  va?: string; // variant (currently babanki only)
  di?: string; // dialect
  nt?: string; // notes
  sr?: string[]; // sources

  // Usage
  xs?: IExampleSentence;
  sfs?: DatabaseAudio[];
  deletedSfs?: DatabaseAudio[];
  pfs?: DatabasePhoto[];
  deletedPfs?: DatabasePhoto[];
  vfs?: DatabaseVideo[];
  deletedVfs?: DatabaseVideo[];
  
  ii?: string; // importId which can be used to show all entries from a particular import
  ei?: string; // Elicitation Id for Munda languages or Swadesh Composite number list from Comparalex
  
  deletedAt?: Timestamp;
}

interface DeprecatedEntry {
  sf?: DatabaseAudio; // sound file
  pf?: DatabasePhoto; // photo file
  xv?: string; // example vernacular - used for old dictionary imports (deprecated)
  ab?: string; // addedBy
  createdBy?: string;
  updatedBy?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
} // when time is found, we can batch convert these fields in the database to the current format


interface LDAlgoliaFields {
  dictId?: string; // dictionary Id entry belongs to, to filter search results by dictionary
  _highlightResult?: any;
  
  hasImage?: boolean;
  hasAudio?: boolean;
  hasSpeaker?: boolean;
  hasSemanticDomain?: boolean;
  hasPartOfSpeech?: boolean;
  hasNounClass?: boolean;
  hasPluralForm?: boolean;
}

