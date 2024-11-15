import type { IUser } from '@living-dictionaries/types'
import { db } from '../config-firebase'

const dictionary_ids = ['shauki', 'nongtrai']

// get_dictionary_emails(dictionary_ids)

async function get_dictionary_emails(dictionary_ids: string[]) {
  const emails = new Set<string>()
  for (const dictionary_id of dictionary_ids) {
    const snapshot = await db.collection(`dictionaries/${dictionary_id}/managers`).get()
    for (const snap of snapshot.docs) {
      const user = (await db.collection('users').doc(snap.id).get()).data() as IUser
      console.log({ user })
      emails.add(user.email)
    }

    const snapshot2 = await db.collection(`dictionaries/${dictionary_id}/contributors`).get()
    for (const snap of snapshot2.docs) {
      const user = (await db.collection('users').doc(snap.id).get()).data() as IUser
      console.log({ user })
      emails.add(user.email)
    }
  }
  console.log(Array.from(emails))
}

async function get_all_emails() {
  const userSnapshots = await db.collection('users').get()
  const users = userSnapshots.docs.map(doc => doc.data()) as IUser[]
  for (const user of users) {
    console.log(user.email)
  }
}

get_all_emails()
