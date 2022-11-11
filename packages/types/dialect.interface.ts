import type { IFirestoreMetaData } from 'sveltefirets';

export interface IDialect extends IFirestoreMetaData {
  dialect: string;
}
