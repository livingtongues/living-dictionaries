import { db } from '../config-firebase'

// deleteDocRecursively(`dictionaries/sipu`);
// copyDoc(`dictionaries/sipu`, `dictionaries/conestoga_language`, {}, true);
// copyDoc(`dictionaries/olùkùmi`, `dictionaries/olukumi`, {}, true);
// moveDoc(`dictionaries/olùkùmi`, `dictionaries/olukumi`);

// from https://leechy.dev/firestore-move
export async function moveDoc(
  oldDocPath: string,
  newDocPath: string,
  addData?: any,
): Promise<boolean | Error> {
  const copied = await copyDoc(oldDocPath, newDocPath, addData, true)

  if (copied) {
    await deleteDocRecursively(`${oldDocPath}`)
    return true
  }
  throw new Error('Data was not copied properly to the target collection, please try again.')
}

export async function copyDoc(
  oldDocPath: string,
  newDocPath: string,
  addData: any = {},
  recursive = false,
): Promise<boolean | Error> {
  const docRef = db.doc(oldDocPath)

  const docData = await docRef
    .get()
    .then(doc => doc.exists && doc.data())
    .catch((error) => {
      throw new Error(`Error reading document ${oldDocPath}: ${JSON.stringify(error)}`)
    })

  if (docData) {
    await db
      .doc(newDocPath)
      .set({ ...docData, ...addData })
      .catch((error) => {
        throw new Error(`Error creating document ${newDocPath}: ${JSON.stringify(error)}`)
      })

    // if copying of the subcollections is needed
    if (recursive) {
      // subcollections
      const subcollections = await docRef.listCollections()
      for await (const subcollectionRef of subcollections) {
        const subcollectionPath = `${oldDocPath}/${subcollectionRef.id}`

        await subcollectionRef
          .get()
          .then(async (snapshot) => {
            const { docs } = snapshot
            for await (const doc of docs) {
              await copyDoc(
                `${subcollectionPath}/${doc.id}`,
                `${newDocPath}/${subcollectionRef.id}/${doc.id}`,
                true,
              )
            }
          })
          .catch((error) => {
            throw new Error(
              `Error reading subcollection ${subcollectionPath}: ${JSON.stringify(error)}`,
            )
          })
      }
    }
    return true
  }
  return false
}

export async function deleteDocRecursively(docPath: string): Promise<boolean> {
  const docRef = db.doc(docPath)

  const subcollections = await docRef.listCollections()
  for await (const subcollectionRef of subcollections) {
    await subcollectionRef
      .get()
      .then(async (snapshot) => {
        const { docs } = snapshot
        for await (const doc of docs)
          await deleteDocRecursively(`${docPath}/${subcollectionRef.id}/${doc.id}`)

        return true
      })
      .catch((error) => {
        console.error(
          'Error reading subcollection',
          `${docPath}/${subcollectionRef.id}`,
          JSON.stringify(error),
        )
        return false
      })
  }

  // when all subcollections are deleted, delete the document itself
  return docRef
    .delete()
    .then(() => true)
    .catch((error) => {
      console.error('Error deleting document', docPath, JSON.stringify(error))
      return false
    })
}
