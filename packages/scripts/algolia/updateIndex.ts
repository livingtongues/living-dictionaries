import { projectId, db } from '../config';
import algoliasearch from 'algoliasearch';

import algoliaKeys from './algolia-admin-key.json';
const ADMIN_KEY = algoliaKeys.adminKey;

import { ALGOLIA_APP_ID } from './config';
const client = algoliasearch(ALGOLIA_APP_ID, ADMIN_KEY);
const index = client.initIndex(
  projectId === 'talking-dictionaries-dev' ? 'entries_dev' : 'entries_prod'
);

const updateIndexByField = async (fieldToIndex: string, dry = false) => {
  const querySnapshot = await db.collectionGroup('words').where(fieldToIndex, '!=', null).get();
  if (dry) {
    querySnapshot.forEach((doc) => {
      console.log(doc.data());
    });
  } else {
    //TODO index entries. Do I need the dictionary ID?
  }
};
//TODO is it fine this way or would it be better to execute this via a command as we do when import dictionaries?
updateIndexByField('nc', true);
