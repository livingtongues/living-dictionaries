import { db } from '../config';
import { updateIndex } from './algolia';
import { ActualDatabaseEntry } from '@living-dictionaries/types';

// import { prepareDataForIndex } from '@living-dictionaries/functions/src/algolia/prepareDataForIndex';
import * as prepare from '@living-dictionaries/functions/src/algolia/prepareDataForIndex';
// @ts-ignore
const prepareDataForIndex = prepare.default
  .prepareDataForIndex as typeof import('@living-dictionaries/functions/src/algolia/prepareDataForIndex').prepareDataForIndex; // b/c file is declared to be commonjs by its package.json

const indexAllDictionaries = async () => {
  const dictionariesSnapshot = await db.collection(`dictionaries`).get();
  const dictionaryIds = dictionariesSnapshot.docs.map((doc) => doc.id);
  console.log(dictionaryIds);
  process.stdout.write(dictionaryIds + '\n');

  for (const dictionaryId of dictionaryIds)
    await indexDictionary(dictionaryId);

};

async function indexDictionary(dictionaryId: string) {
  const entriesSnapshot = await db.collection(`dictionaries/${dictionaryId}/words`).get();
  const entries = await prepareEntriesFromSnapshot(entriesSnapshot, dictionaryId);
  await updateIndex(entries);
}

// eslint-disable-next-line no-undef
async function prepareEntriesFromSnapshot(entriesSnapshot: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>, dictionaryId: string) {
  const entryPromises = entriesSnapshot.docs.map(async (doc) => {
    const dbEntry = doc.data() as ActualDatabaseEntry;
    const algoliaEntry = await prepareDataForIndex(dbEntry, dictionaryId, db);
    console.log({ dbEntry, algoliaEntry});
    return { ...algoliaEntry, objectID: doc.id };
  });

  const entries = await Promise.all(entryPromises);
  return entries;
}

// indexAllDictionaries();
// indexDictionary('conestoga_language');
