import { db } from './config-firebase'

export async function countAllEntries() {
  let overallEntryCount = 0

  const dictionarySnaps = await db.collection('dictionaries').get()
  const dictionaryIds = dictionarySnaps.docs.map(doc => doc.id)

  for (const dictionaryId of dictionaryIds) {
    if (dictionaryId.startsWith('tdv1-')) continue

    const countData = await db.collection(`dictionaries/${dictionaryId}/words`).count().get()
    const { count: entryCount } = countData.data()
    console.log({ dictionaryId, entryCount, overallEntryCount })
    overallEntryCount += entryCount
    console.log({ dictionaryId, entryCount, overallEntryCount })
    await db.doc(`dictionaries/${dictionaryId}`).update({ entryCount })
  }

  await db.doc('stats/data').update({ overallEntryCount })

  return true
}

countAllEntries().then(() => console.log('done')).catch(console.error)
