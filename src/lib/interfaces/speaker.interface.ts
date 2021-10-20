import type { IFirestoreMetaData } from '.';

export interface ISpeaker extends IFirestoreMetaData {
  displayName: string;
  uid?: string; // matches uid of signed-up user if they also have an account
  decade?: number; // used to be a string - refactor in database
  gender?: Gender;
  birthplace?: string;
  contributingTo?: string[]; // array of dictionaryIDs
  photoURL?: string;
}

export type Gender = 'm' | 'f' | 'o';
