// Optimization from https://github.com/CodingDoug/min-functions-cold-start
// Read https://medium.com/firebase-developers/organize-cloud-functions-for-max-cold-start-performance-and-readability-with-typescript-and-9261ee8450f0

// This should be the only import in index.ts beside function imports
import * as functions from 'firebase-functions';

// TODO: restore
// export const updateDevAdminRole = functions.https.onCall(async (data, context) => {
  //   return (await import('./updateDevAdminRole')).default(data, context);
  // });
  
// // Export
// export const exportSemanticDomainOfDictionary = functions.https.onRequest(async (req, res) => {
//   await (await import('./export/semanticDomainOfDictionary')).default(req, res);
// });
// TODO: end restore

// Email
export const supportEmail = functions.https.onCall(async (data, context) => {
  return (await import('./email/supportEmail')).default(data, context);
});

export const inviteContributor = functions.firestore
  .document('dictionaries/{dictionaryId}/invites/{inviteId}')
  .onCreate(async (snapshot, context) => {
    await (await import('./email/inviteContributor')).default(snapshot, context);
  });

export const onNewUser = functions.firestore
  .document('users/{userId}')
  .onCreate(async (snapshot, context) => {
    await (await import('./email/onNewUser')).default(snapshot, context);
  });

export const onNewDictionary = functions.firestore
  .document('dictionaries/{dictionaryId}')
  .onCreate(async (snapshot, context) => {
    await (await import('./email/onNewDictionary')).default(snapshot, context);
  });

// TODO: restore
// // Aggregation
// export const increaseEntryCount = functions.firestore
//   .document('dictionaries/{dictionaryId}/words/{wordId}')
//   .onCreate(async (snapshot, context) => {
//     await (await import('./aggregation/increaseEntryCount')).default(snapshot, context);
//   });

// export const decreaseEntryCount = functions.firestore
//   .document('dictionaries/{dictionaryId}/words/{wordId}')
//   .onDelete(async (snapshot, context) => {
//     await (await import('./aggregation/decreaseEntryCount')).default(snapshot, context);
//   });

// // Deletion
// export const deleteMediaOnDictionaryDelete = functions.firestore
//   .document('dictionaries/{dictionaryId}')
//   .onDelete(async (snapshot, context) => {
//     await (await import('./deletion/deleteMediaOnDictionaryDelete')).default(snapshot, context);
//   });

// export const recursiveDelete = functions
//   .runWith({
//     timeoutSeconds: 540,
//     memory: '2GB',
//   })
//   .https.onCall(async (data, context) => {
//     return (await import('./deletion/recursiveDelete')).default(data, context);
//   });
// TODO: end restore

// Import
// export { processImport } from './import/importing';

// Algolia Search Indexing
export const addToIndex = functions.firestore
  .document('dictionaries/{dictionaryId}/words/{wordId}')
  .onCreate(async (snapshot, context) => {
    await (await import('./algolia/modifyIndex')).addToIndex(snapshot, context);
  });

export const updateIndex = functions.firestore
  .document('dictionaries/{dictionaryId}/words/{wordId}')
  .onUpdate(async (change, context) => {
    await (await import('./algolia/modifyIndex')).updateIndex(change, context);
  });

export const deleteFromIndex = functions.firestore
  .document('dictionaries/{dictionaryId}/words/{wordId}')
  .onDelete(async (snapshot, context) => {
    await (await import('./algolia/modifyIndex')).deleteFromIndex(snapshot, context);
  });

// Video

/* export const uploadToYouTube = functions
  .runWith({
    timeoutSeconds: 540,
    memory: '4GB',
  })
  .firestore.document('dictionaries/{dictionaryId}/words/{entryId}/videos/{videoId')
  .onCreate(async (snapshot, context) => {
    await (await import('./video/uploadToYouTube')).uploadToYouTube(snapshot, context);
  }); */

// export const latestYoutubeVideo = functions.https.onRequest(async (req, res) => {
//   await (await import('./video/uploadToYouTube')).latestYoutubeVideo(req, res);
// });

// export const test = functions.https.onRequest(async (req, res) => {
//   console.log('This is just a simple test');
//   // Send back a message that we've successfully written the message
//   res.json({ result: `Hello World` });
// });
