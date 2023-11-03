import type { Timestamp } from 'firebase/firestore';

export interface History {
  editor: string;
  editedLexeme: string,
  entryId: string,
  editedDictionaryId: string,
  action: string,
  // field?: string, by request
  updatedAt: Timestamp;
}

// export interface Change {
//   updatedBy: string;
//   updatedName: string;
//   entryId: string;
//   dictionaryId: string;
//   dictionaryName: string;
//   previousValue: string;
//   currentValue: string;
//   field: string; //by request
//   updatedAtMs: number;
// }
