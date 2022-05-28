import * as functions from 'firebase-functions';
const projectId = functions.config().project.key;
import { db } from './config';

export default async (data: any, context: functions.https.CallableContext) => {
  if (projectId !== 'talking-dictionaries-alpha' && typeof data.role === 'number') {
    console.log('Set admin role to: ', data.role);
    await db.doc(`users/${context.auth?.uid}`).update({
      roles: {
        admin: data.role,
      },
    });
    return true;
  } else {
    return true;
  }
};
