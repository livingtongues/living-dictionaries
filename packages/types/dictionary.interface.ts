import type { GeoPoint } from 'firebase/firestore';
import type { IFirestoreMetaData } from 'sveltefirets';

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

  featuredImage?: FeaturedImage; // Featured image for dictionaries to show as SEO image

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
export interface FeaturedImage {
  path?: string; // Firebase storage location
  gcsPath?: string; // Google's Magic Image serving url reference which accepts requests for exact image size https://medium.com/google-cloud/uploading-resizing-and-serving-images-with-google-cloud-platform-ca9631a2c556
  addedBy?: string; // added by uid
  timestamp?: number; // timestamp in milliseconds, Firestore Timestamps not supported inside arrays
}

interface LngLatFull {
  longitude: number;
  latitude: number;
}

