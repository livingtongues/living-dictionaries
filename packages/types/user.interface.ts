import type { Timestamp } from 'firebase/firestore';
import type { IFirestoreMetaData } from 'sveltefirets';

export type IUser = User & Omit<IFirestoreMetaData, 'id'>;

interface User {
  uid?: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  lastVisit?: Timestamp;

  roles?: IRoles;
  managing?: string[]; // dictionary Ids - can be deprected because using a collectionGroup query of 'managers' instead
  contributing?: string[]; // dictionary Ids - can be deprected because using a collectionGroup query 'contributors' instead
  // starred?: string[]; // in future save dictionary Ids to user that they star, to allow them quick access back to those dictionaries
  termsAgreement?: Timestamp;
  unsubscribe?: Timestamp;
}

export interface IRoles {
  // editor?: boolean; // can edit and delete any content
  admin?: number; // 1 controls content; 2 controls user roles also (both can turn off admin role to view as normal user until page refresh)
}
