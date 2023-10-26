import type { Timestamp } from 'firebase/firestore';

export interface History {
  editor: string;
  editedLexeme: string,
  editedDictionaryId: string,
  action: string,
  // field?: string, by request
  updatedAt: Timestamp;
}
