import type { ActualDatabaseEntry } from '@living-dictionaries/types'
import * as prepare from '@living-dictionaries/functions/src/algolia/prepareDataForIndex'
import { db } from '../config-firebase'
import { updateIndex } from './algolia'

// import { prepareDataForIndex } from '@living-dictionaries/functions/src/algolia/prepareDataForIndex';
// @ts-expect-error
const prepareDataForIndex = prepare.default
  .prepareDataForIndex as typeof import('@living-dictionaries/functions/src/algolia/prepareDataForIndex').prepareDataForIndex // b/c file is declared to be commonjs by its package.json

async function updateMostRecentEntries(count: number, { dry = true }) {
  const entriesSnapshot = await db.collectionGroup('words').orderBy('ua', 'desc').limit(count).get()
  const entries = await prepareEntriesFromSnapshot(entriesSnapshot)

  if (!dry)
    await updateIndex(entries)
}

async function updateIndexByField(fieldToIndex: string, { dry = true }) {
  // The field must be indexed first in Firebase
  const entriesSnapshot = await db.collectionGroup('words').where(fieldToIndex, '!=', null).get()
  const entries = await prepareEntriesFromSnapshot(entriesSnapshot)

  if (!dry)
    await updateIndex(entries)
}

async function prepareEntriesFromSnapshot(entriesSnapshot: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>) {
  const entryPromises = entriesSnapshot.docs.map(async (doc) => {
    const dbEntry = doc.data() as ActualDatabaseEntry
    const dictionaryId = doc.ref.parent.parent.id // dictionary/words/entry-123 -> doc.ref: entry-123, doc.ref.parent: words, doc.ref.parent.parent: dictionary
    const algoliaEntry = await prepareDataForIndex(dbEntry, dictionaryId, db)
    const time = dbEntry.ua.toDate()
    console.log({ dbEntry, algoliaEntry, time })
    return { ...algoliaEntry, objectID: doc.id }
  })

  const entries = await Promise.all(entryPromises)
  return entries
}

// updateIndexByField('nc', { dry: true });
updateMostRecentEntries(300, { dry: false })
