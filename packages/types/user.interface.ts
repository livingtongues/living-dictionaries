import type { Timestamp } from 'firebase/firestore'
import type { IBaseUser } from 'sveltefirets'

export interface IUser extends IBaseUser {
  roles?: IRoles
  managing?: string[] // dictionary Ids - can be deprected because using a collectionGroup query of 'managers' instead
  contributing?: string[] // dictionary Ids - can be deprected because using a collectionGroup query 'contributors' instead
  // starred?: string[]; // in future save dictionary Ids to user that they star, to allow them quick access back to those dictionaries
  termsAgreement?: Timestamp
  unsubscribe?: Timestamp
}

export interface IRoles {
  // editor?: boolean; // can edit and delete any content
  admin?: number // 1 controls content; 2 controls user roles also
}

export interface GoogleAuthUserMetaData {
  // "iss": string,
  // "sub": string,
  // "name": string,
  // "email": string,
  // "picture": string, // duplicate of avatar_url
  full_name?: string
  avatar_url?: string
  // "provider_id": string,
  // "email_verified": boolean,
  // "phone_verified": boolean
}
