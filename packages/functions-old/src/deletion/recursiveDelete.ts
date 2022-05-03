import * as functions from 'firebase-functions';
const firebase_tools = require('firebase-tools');

/**
 * Initiate a recursive delete of documents at a given path.
 *
 * The calling user must be authenticated and have the custom "admin" attribute
 * set to true on the auth token.
 *
 * This delete is NOT an atomic operation and it's possible
 * that it may fail after only deleting some documents.
 *
 * @param {string} data.path the document or collection path to delete.
 */
export default async (data: any, context: functions.https.CallableContext) => {
  // if (!(context.auth && context.auth.token && context.auth.token.admin)) {
  // Only allow authorized users to execute this function. // Could improve by reading user data from Firestore and looking at admin role > 1
  if (
    !(
      context.auth &&
      (context.auth.uid === '0seqYnZOqkUz050y6jVQI9QvlW62' ||
        context.auth.uid === '2PELJgjxMHXEOcuZfv9MtGyiXdE3')
    )
  ) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Must be an administrative user to initiate delete.'
    );
  }

  const path = data.path;
  console.log(`User ${context.auth.uid} has requested to delete path ${path}`);

  // Run a recursive delete on the given document or collection path.
  // The 'token' must be set in the functions config, and can be generated
  // at the command line by running 'firebase login:ci'.
  await firebase_tools.firestore.delete(path, {
    project: process.env.GCLOUD_PROJECT,
    recursive: true,
    yes: true,
    token: functions.config().fb.token,
  });
  return {
    path: path,
  };
};
