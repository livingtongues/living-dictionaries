import { db } from '../db';

export async function countAllEntries() {
  let overallEntryCount = 0;

  const dictionarySnaps = await db.collection('dictionaries').get();
  const dictionaryIds = dictionarySnaps.docs.map(doc => doc.id);

  for (const dictionaryId of dictionaryIds) {
    const countData = await db.collection(`dictionaries/${dictionaryId}/words`).count().get();
    const { count: entryCount } = countData.data();
    overallEntryCount += entryCount;
    await db.doc(`dictionaries/${dictionaryId}`).update({ entryCount });
  }

  await db.doc('stats/data').update({ overallEntryCount });

  return true;
}