import type { IFirestoreMetaData } from '.';
export interface IInvite extends IFirestoreMetaData {
    inviterEmail: string;
    inviterName: string;
    dictionaryName: string;
    targetEmail: string;
    role: 'manager' | 'contributor';
    status: 'queued' | 'sent' | 'claimed' | 'cancelled';
}
