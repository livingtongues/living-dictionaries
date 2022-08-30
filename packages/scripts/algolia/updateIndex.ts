import { projectId, db } from '../config';
import algoliasearch from 'algoliasearch';

import algoliaKeys from './algolia-admin-key.json';
const ADMIN_KEY = algoliaKeys.adminKey;

import { ALGOLIA_APP_ID } from './config';
const client = algoliasearch(ALGOLIA_APP_ID, ADMIN_KEY);
const index = client.initIndex(
  projectId === 'talking-dictionaries-dev' ? 'entries_dev' : 'entries_prod'
);

import fs from 'fs';
const iterateThroughDictionaries = async (fieldToIndex: string, dry = false) => {
  // FIRST TRY
  /* const dictionariesSnapshot = await db.collection(`dictionaries`).get();
  const dictionaryIds = dictionariesSnapshot.docs.map((doc) => doc.id);
  //process.stdout.write(dictionaryIds + '\n');

  for (const dictionaryId of dictionaryIds) {
    const wordsRef = db.collection(`dictionaries/${dictionaryId}/words`);
    const selected = await wordsRef.where(fieldToIndex, '!=', null).get();
    selected.forEach((doc) => console.log(doc.data()));
  } */
  const querySnapshot = await db.collectionGroup('words').where(fieldToIndex, '!=', null).get();
  querySnapshot.forEach((doc) => {
    console.log(doc.data());
  });
};
iterateThroughDictionaries('nc', true);
