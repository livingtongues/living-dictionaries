import * as functions from 'firebase-functions';
import { google } from 'googleapis';
// import YouTubeUploadAPI;

// Set by running `firebase functions:config:set youtube.key="..."`
// read with `firebase functions:config:get`
//console.log('YouTube key', functions.config().youtube);

const youtube = google.youtube({
  version: 'v3',
  auth: [[YOUTUBE_API]],
});
//const KEY = functions.config().youtube.key;
const projectId = [[PROJECT_ID]];

// const api = new YouTubeUploadAPI(KEY);

// import { IVideo } from '../../../src/lib/interfaces';
//TESTING
export const latestYoutubeVideo = functions.https.onRequest(async (req, res: any) => {
  // Get channelId from query string
  const { channelId } = req.query;
  // Generate query to Youtube API
  // Get a list, ordered by date and limited to one item
  // Frankly, it's an array with 1 latest video
  const { data } = await youtube.search.list({
    part: ['id'],
    channelId,
  });

  // Get ID object from items[0]
  const { id } = data.items[0];

  // Get Video ID from Id object
  // Redirect to link with this video ID
  return res.redirect(`https://www.youtube.com/watch?v=${id.videoId}`); //res.json({ test: data });
});

/* export const uploadToYouTube = async (
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
}; */
