// Optimization from https://github.com/CodingDoug/min-functions-cold-start
// Read https://medium.com/firebase-developers/organize-cloud-functions-for-max-cold-start-performance-and-readability-with-typescript-and-9261ee8450f0

// firebase-functions should be the only imports in index.ts beside function imports
import { firestore } from 'firebase-functions';
import {
  onDocumentCreated,
  onDocumentDeleted,
} from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';

// TODO: create endpoints
// updateDevAdminRole
// exportSemanticDomainOfDictionary // if needed or just work on the api endpoint
// deleteMediaOnDictionaryDelete
// recursiveDelete, .runWith({ timeoutSeconds: 540, memory: '2GB' })

// Aggregation
export const increaseEntryCount = onDocumentCreated('dictionaries/{dictionaryId}/words/{wordId}', async (event) => {
  await (await import('./aggregation')).increaseEntryCount(event);
});

export const decreaseEntryCount = onDocumentDeleted('dictionaries/{dictionaryId}/words/{wordId}', async (event) => {
  await (await import('./aggregation')).decreaseEntryCount(event);
});

// can manually run task at https://console.cloud.google.com/cloudscheduler?project=talking-dictionaries-alpha
export const countAllEntries = onSchedule('every day 00:00', async () => {
  await (await import('./aggregation/countAllEntries')).countAllEntries();
});

// Algolia Search Indexing
export const addToIndex = firestore
  .document('dictionaries/{dictionaryId}/words/{wordId}')
  .onCreate(async (snapshot, context) => {
    await (await import('./algolia/modifyIndex')).addToIndex(snapshot, context);
  });

export const updateIndex = firestore
  .document('dictionaries/{dictionaryId}/words/{wordId}')
  .onUpdate(async (change, context) => {
    await (await import('./algolia/modifyIndex')).updateIndex(change, context);
  });

export const deleteFromIndex = firestore
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
