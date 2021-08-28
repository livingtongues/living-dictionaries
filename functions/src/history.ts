import * as functions from 'firebase-functions';
import { db, oneMinuteAgo } from './config';

export const saveVersionHistory = functions.firestore
    .document('dictionaries/{dictionaryId}/words/{wordId}')
    .onUpdate(async (change, context) => {
        const newValue = change.after.data(); 
        const previousValue = change.before.data();
        console.log(newValue, previousValue);
        if (!previousValue.ua) {
            previousValue.ua = oneMinuteAgo; // to keep history from getting out of order in case of entries without an updated at field
        }
        console.log(newValue, previousValue);

        const dictionaryId = context.params.dictionaryId;
        const wordId = context.params.wordId;
        const wordHistoryColRef = db.collection(`dictionaries/${dictionaryId}/words/${wordId}/history`);
        await wordHistoryColRef.add({previousValue}) 
        // TODO, make sure app is saving updatedAt timestamps

        return true;
    })