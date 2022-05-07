import * as admin from 'firebase-admin';
export const firebase = admin.initializeApp();

export const db = admin.firestore();
const settings = { timestampsInSnapshots: true};
db.settings(settings);

export const timestamp = admin.firestore.FieldValue.serverTimestamp();
export const oneMinuteAgo = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 1000 * 60));
export const testingTimestamp = admin.firestore.Timestamp.fromDate(new Date);

export const increment = admin.firestore.FieldValue.increment(1);
export const decrement = admin.firestore.FieldValue.increment(-1);

export const storage = admin.storage();
