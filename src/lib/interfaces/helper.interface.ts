import type { IFirestoreMetaData } from '.';

export interface IHelper extends IFirestoreMetaData {
  name: string;
}

export type HelperRoles = 'manager' | 'contributor' | 'writeInCollaborator';
