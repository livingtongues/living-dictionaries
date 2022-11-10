import type { IFirestoreMetaData } from 'sveltefirets';

export interface IDialect extends IFirestoreMetaData {
  dialect: string;
}

export interface IAlgoliaDialect {
  facetHits: any[];
  exhaustiveFacetsCount: boolean;
  processingTimeMS: number;
}
