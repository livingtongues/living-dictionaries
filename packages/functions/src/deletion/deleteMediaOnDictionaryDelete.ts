import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
admin.initializeApp();

export default async (
    snapshot: functions.firestore.DocumentSnapshot,
    context: functions.EventContext
) => {
    const { dictionaryId } = context.params;
    const bucket = admin.storage().bucket();

    return bucket.deleteFiles({
        prefix: `${dictionaryId}`
    });
};
