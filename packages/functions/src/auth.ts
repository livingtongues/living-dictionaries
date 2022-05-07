// import * as functions from 'firebase-functions';
// import { db } from './config';

// export const createUserRecord = functions.auth
//   .user()
//   .onCreate((user, context) => {
//     const userRef = db.doc(`users/${user.uid}`);

//     return userRef.set({
//       name: user.displayName,
//       createdAt: context.timestamp,
//       nickname: 'bubba'
//     });
//   });
