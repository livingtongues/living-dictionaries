import * as functions from 'firebase-functions';
const projectId = functions.config().project.key;

import * as admin from 'firebase-admin';
admin.initializeApp();

export default async (
    data: any,
    context: functions.https.CallableContext
) => {
    if (projectId !== 'talking-dictionaries-alpha' && typeof data.role === 'number') {
        console.log('Set admin role to: ', data.role);
        await admin.firestore().doc(`users/${context.auth.uid}`).update({
            roles: {
                admin: data.role
            }
        });
        return true;
    } else {
        return true;
    }
}