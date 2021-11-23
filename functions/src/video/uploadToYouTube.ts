import * as functions from 'firebase-functions';
// import YouTubeUploadAPI;

// Set by running `firebase functions:config:set youtube.key="..."`
// read with `firebase functions:config:get`
const KEY = functions.config().youtube.key;
const projectId = functions.config().project.key;

// const api = new YouTubeUploadAPI(KEY);

// import { IVideo } from '../../../src/lib/interfaces';

export const uploadToYouTube = async (
  snapshot: functions.firestore.DocumentSnapshot,
  context: functions.EventContext
) => {
  const videoID = snapshot.id;
  console.log(`uploading ${videoID} to YouTube`);
  const dictionaryId = context.params.dictionaryId;
  const entryId = context.params.entryId;
  // const video = snapshot.data() as IVideo;

  if (projectId === 'talking-dictionaries-alpha') {
    // uploaded from prod (may not be needed?)
  } else {
    // uploaded from dev
  }

  // write error/success state to video doc in Firestore
  return true;
};
