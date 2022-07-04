import type { IFirestoreMetaData } from 'sveltefirets';

export interface IImport extends IFirestoreMetaData {
    path?: string; // Firebase storage path
    createdByName?: string;
    entryCount?: number;
    memoryUsage?: any;
    elapsedTime?: number;
    status?: 'uploaded' | 'processing' | 'success' | 'error';
    error?: string;
}
