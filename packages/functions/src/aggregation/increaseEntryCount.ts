import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
admin.initializeApp();

export default async (
    snapshot: functions.firestore.DocumentSnapshot,
    context: functions.EventContext
) => {
    const dictionaryId = context.params.dictionaryId;
    console.log('about to increment entry count');
    await admin.firestore().doc(`dictionaries/${dictionaryId}`).update({ entryCount: admin.firestore.FieldValue.increment(1) });
    return true;
}