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
const iterateThroughDictionaries = async () => {
  const dictionariesSnapshot = await db.collection(`dictionaries`).get();
  const dictionaryIds = dictionariesSnapshot.docs.map((doc) => doc.id);
  console.log(dictionaryIds);
  process.stdout.write(dictionaryIds + '\n');

  for (const dictionaryId of dictionaryIds) {
    await indexDictionary(dictionaryId);
  }
};
// iterateThroughDictionaries();

import { prepareDataForIndex } from './prepareDataForIndex';
import { IEntry } from '@living-dictionaries/types';

async function indexDictionary(dictionaryId: string) {
  const entriesSnapshot = await db.collection(`dictionaries/${dictionaryId}/words`).get();
  const entryPromises = entriesSnapshot.docs.map(async (doc) => {
    const entry = await prepareDataForIndex(doc.data() as IEntry, dictionaryId, db);
    return { ...entry, objectID: doc.id };
  });

  const entries = await Promise.all(entryPromises);

  console.log(entries);

  // https://www.algolia.com/doc/api-reference/api-methods/add-objects/#examples
  // if forced to iterate instead of save all at once, take note of the rate limiting at 5000 backlogged requests https://www.algolia.com/doc/faq/indexing/is-there-a-rate-limit/
  index
    .saveObjects(entries)
    .then(({ objectIDs }) => {
      console.log('Entries indexed: ', objectIDs.length);
    })
    .catch((err) => {
      console.log(err);
    });
}

// indexDictionary('conestoga_language');
