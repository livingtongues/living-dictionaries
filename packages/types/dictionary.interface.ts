import type { GeoPoint } from 'firebase/firestore';
import type { IFirestoreMetaData } from 'sveltefirets';
import type { DictionaryPhoto } from '.';

export interface IDictionary extends IFirestoreMetaData {
  // allContribute?: boolean; // deprecated
  alternateNames?: string[];
  glossLanguages: string[];
  name: string;
  location?: string;
  iso6393?: string;
  glottocode?: string;

  coordinates?: GeoPoint | LngLatFull; // primary coordinate when displayed w/ many other dictionaries
  points?: IPoint[]; // other coordinate points where language spoken
  regions?: IRegion[]; // regions where language spoken

  public?: boolean;
  printAccess?: boolean;
  entryCount?: number; // number | FieldValue;
  copyright?: string; // Allow custom copyright in case "Copyright _______ community" isn't appropriate for dictionary (eg. Tehuelche)
  alternateOrthographies?: string[]; // Alternate Orthography titles (first item corresponds to entry.lo, then entry.lo2, entry.lo3) - used to be called Local Orthography but that is a misnomer it's turning out

  videoAccess?: boolean;

  languageUsedByCommunity?: boolean;
  communityPermission?: 'yes' | 'no' | 'unknown';
  authorConnection?: string;
  conLangDescription?: string;

  featuredImage?: DictionaryPhoto;

  // tdv1 (old Talking Dictionaries platform at Swarthmore)
  publishYear?: number;
  population?: number;
  thumbnail?: string;
  url?: string;
  type?: 'tdv1';
}

// Requested to add links to Wikipedia pages for languages (EWA)
// Basically an array of relevant sourcs or links (WIP)

export interface IAbout extends IFirestoreMetaData {
  about: string;
}

export interface IGrammar extends IFirestoreMetaData {
  grammar: string;
}

export interface ICitation extends IFirestoreMetaData {
  citation: string;
}

export interface IPoint {
  coordinates: LngLatFull;
  label?: string;
  color?: string;
}

export interface IRegion {
  coordinates: LngLatFull[];
  label?: string;
  color?: string;
}

interface LngLatFull {
  longitude: number;
  latitude: number;
}

