import { FirestoreEvent, QueryDocumentSnapshot } from 'firebase-functions/v2/firestore';
import { db } from '../db';
import { FieldValue } from 'firebase-admin/firestore';

export async function increaseEntryCount({ params }: FirestoreEvent<QueryDocumentSnapshot, { dictionaryId: string }>) {
    const dictionaryId = params.dictionaryId;
    await db.doc(`dictionaries/${dictionaryId}`).update({ entryCount: FieldValue.increment(1) });
    await db.doc('stats/data').update({ overallEntryCount: FieldValue.increment(1) });
    return true;
}

export async function decreaseEntryCount({ params }: FirestoreEvent<QueryDocumentSnapshot, { dictionaryId: string }>) {
    const dictionaryId = params.dictionaryId;
    await db.doc(`dictionaries/${dictionaryId}`).update({ entryCount: FieldValue.increment(-1) });
    await db.doc('stats/data').update({ overallEntryCount: FieldValue.increment(-1) });
    return true;
}