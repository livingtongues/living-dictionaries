import type { IFirestoreMetaData } from 'sveltefirets';

export interface IHelper extends IFirestoreMetaData {
  name: string;
}

export type HelperRoles = 'manager' | 'contributor' | 'writeInCollaborator';
