import * as functions from 'firebase-functions';
import algoliasearch from 'algoliasearch';
import { db } from '../config';
// Set by running `firebase functions:config:set algolia.app="..."`
// read with `firebase functions:config:get`
const APP_ID = functions.config().algolia.app_id;
const ADMIN_KEY = functions.config().algolia.admin_key;
const projectId = functions.config().project.key;

const client = algoliasearch(APP_ID, ADMIN_KEY);
const prodIndex = client.initIndex('entries_prod');
const devIndex = client.initIndex('entries_dev');

import { prepareDataForIndex } from './prepareDataForIndex';
import { IEntry } from '@living-dictionaries/types';

export const addToIndex = async (
  snapshot: functions.firestore.DocumentSnapshot,
  context: functions.EventContext
) => {
  const objectID = snapshot.id;
  console.log(`adding ${objectID} to Algolia index`);
  const dictionaryId = context.params.dictionaryId;
  const entry = await prepareDataForIndex(snapshot.data() as IEntry, dictionaryId, db);
  if (projectId === 'talking-dictionaries-alpha') {
    await prodIndex.saveObject({ objectID, ...entry });
  }
  await devIndex.saveObject({ objectID, ...entry });
  return true;
};

export const updateIndex = async (
  change: functions.Change<functions.firestore.DocumentSnapshot>,
  context: functions.EventContext
) => {
  const objectID = change.after.id;
  console.log(`updating ${objectID} in Algolia index`);
  const dictionaryId = context.params.dictionaryId;
  const entry = await prepareDataForIndex(change.after.data() as IEntry, dictionaryId, db);
  if (projectId === 'talking-dictionaries-alpha') {
    await prodIndex.saveObject({ objectID, ...entry });
  }
  await devIndex.saveObject({ objectID, ...entry });
  return true;
};

export const deleteFromIndex = async (
  snapshot: functions.firestore.DocumentSnapshot,
) => {
  console.log(`deleting ${snapshot.id} from Algolia index`);
  if (projectId === 'talking-dictionaries-alpha') {
    await prodIndex.deleteObject(snapshot.id);
  }
  await devIndex.deleteObject(snapshot.id);
  return true;
};
