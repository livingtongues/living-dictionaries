import type { Timestamp } from 'firebase/firestore';
import type { IFirestoreMetaData, IFirestoreMetaDataAbbreviated } from 'sveltefirets';
import type { IGloss } from './gloss.interface';
import type { IExampleSentence } from './exampe-sentence.interface';
import type { GoalDatabaseAudio, ActualDatabaseAudio, ExpandedAudio } from './audio.interface';
import type { GoalDatabasePhoto, ActualDatabasePhoto, ExpandedPhoto } from './photo.interface';
import type { GoalDatabaseVideo, ActualDatabaseVideo, ExpandedVideo } from './video.interface';
import type { LDAlgoliaFields } from './entry.algolia.interface';

// current interface used across the site that we will migrate from this to just ExpandedEntry
export type IEntry = ExpandedEntry & ActualDatabaseEntry & Omit<LDAlgoliaFields, 'ua' | 'ca'>;
export type LDAlgoliaHit = ActualDatabaseEntry & LDAlgoliaFields;

export interface ExpandedEntry extends IFirestoreMetaData {
  lexeme?: string;
  local_orthography_1?: string;
  local_orthography_2?: string;
  local_orthography_3?: string;
  local_orthography_4?: string;
  local_orthography_5?: string;
  phonetic?: string;
  sound_files?: ExpandedAudio[];
  senses?: ExpandedSense[];
  interlinearization?: string;
  morphology?: string;
  plural_form?: string;
  variant?: string;
  dialects?: string[];
  notes?: string;
  sources?: string[];
  elicitation_id?: string;
  deletedAt?: Timestamp;
  importId?: string; // TODO: expand this also
  scientific_names?: string[]; // italic by default but they can use <i> and </i> to define where italics show
  geo_tagging?: string;
}

export interface ExpandedSense {
  glosses?: IGloss;
  parts_of_speech?: string[]; // translation to current language happens during expansion
  semantic_domains?: string[]; // translation to current language happens during expansion
  example_sentences?: IExampleSentence[];
  photo_files?: ExpandedPhoto[];
  video_files?: ExpandedVideo[];
  noun_class?: string;
  definition_english?: string;
}

export interface DatabaseSense {
  gl?: IGloss;
  ps?: string[]; // parts_of_speech
  sd?: string[]; // semantic domain strings, only using for custom semantic domains brought in from imports
  sdn?: string[]; // semantic domain number, simplified system modeled after SemDom (eg. 2.1.2.3)
  xs?: IExampleSentence[];
  pfs?: GoalDatabasePhoto[];
  deletedPfs?: GoalDatabasePhoto[];
  vfs?: GoalDatabaseVideo[];
  deletedVfs?: GoalDatabaseVideo[];
  nc?: string; // noun_class
  de?: string; // definition_english, only in Bahasa Lani (jaRhn6MAZim4Blvr1iEv) deprecated by Greg
}

export type ActualDatabaseEntry = Omit<GoalDatabaseEntry, 'di' | 'sr'> & DeprecatedEntry;

export interface GoalDatabaseEntry extends IFirestoreMetaDataAbbreviated {
  lx?: string; // lexeme
  lo1?: string; // local_orthography_2
  lo2?: string; // local_orthography_2
  lo3?: string; // local_orthography_3
  lo4?: string; // local_orthography_4
  lo5?: string; // local_orthography_5
  ph?: string; // phonetic
  sfs?: GoalDatabaseAudio[];
  deletedSfs?: GoalDatabaseAudio[]; // TODO sound files into here of subcollection when deleted
  sn?: DatabaseSense[];
  in?: string; // interlinearization
  mr?: string; // morphology
  pl?: string; // plural_form
  va?: string; // variant (currently babanki & torwali only)
  di?: string[]; // dialects
  nt?: string; // notes
  sr?: string[]; // sources
  ei?: string; // Elicitation Id for Munda languages or Swadesh Composite number list from Comparalex
  deletedAt?: Timestamp;
  ii?: string; // importId which can be used to show all entries from a particular import
  scn?: string[]; // scientific_names
  gt?: string; // geo_tagging
}

interface DeprecatedEntry extends Omit<DatabaseSense, 'ps' | 'xs' | 'pfs' | 'deletedPfs' | 'vfs'> {
  // as deprecated fields are removed from the database we can continue to Omit them here until nothing more from DatabaseSense is left
  lo?: string; // local_orthography_1
  sf?: ActualDatabaseAudio; // turned into array at sfs
  di?: string | string[]; // turned into array
  sr?: string | string[] // some dictionaries, e.g. Kalanga, have just a string

  // placed into first sense
  ps?: string | string[]; // parts_of_speech
  pf?: ActualDatabasePhoto; // photo file
  vfs?: ActualDatabaseVideo[]; // video files
  xs?: IExampleSentence;
  xv?: string; // example vernacular - used for old dictionary imports (deprecated)

  // old metadata
  ab?: string; // addedBy
  createdBy?: string;
  updatedBy?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
} // we can set up a nightly function to batch convert 1000 entries with deprecated fields in the database to the current format and then as fields get weeded out they can be removed from here

// Note: entry.cb is "OTD" for entries that came from the Old Talking Dictionaries platform
