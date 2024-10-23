import fs from 'node:fs'
import path, { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ActualDatabaseEntry } from '@living-dictionaries/types/entry.interface'
import type { ISpeaker } from '@living-dictionaries/types/speaker.interface'
import { db } from '../config-firebase'
import { get_users } from './auth'

const FOLDER = 'firestore-data'
const __dirname = dirname(fileURLToPath(import.meta.url))

export async function write_entries() {
  const entries: ActualDatabaseEntry[] = []

  const dict_snapshot = await db.collection('dictionaries').get()

  for (const { id: dictionary_id } of dict_snapshot.docs) {
    console.log(dictionary_id)
    // const allow = /^[a].*/
    // if (!allow.test(dictionary_id.toLowerCase())) continue

    const snapshot = await db.collection(`dictionaries/${dictionary_id}/words`).get()

    for (const snap of snapshot.docs) {
      const entry = { id: snap.id, dictionary_id, ...(snap.data() as ActualDatabaseEntry) }
      entries.push(entry)
    }
  }

  console.log(`Done fetching ${entries.length} entries from ${dict_snapshot.docs.length} dictionaries.`)

  fs.writeFileSync(path.resolve(__dirname, FOLDER, 'firestore-entries.json'), JSON.stringify(entries, null, 2))
}

export async function write_speakers() {
  const speakers: ISpeaker[] = []

  const speaker_snapshots = await db.collection('speakers').get()

  for (const speaker_snap of speaker_snapshots.docs) {
    const speaker = { id: speaker_snap.id, ...(speaker_snap.data() as ISpeaker) }
    speakers.push(speaker)
  }

  console.log(`Done fetching ${speakers.length} speakers.`)

  fs.writeFileSync(path.resolve(__dirname, FOLDER, 'firestore-speakers.json'), JSON.stringify(speakers, null, 2))
}

export async function write_users() {
  const users = await get_users()

  console.log(`Done fetching ${users.length} users.`)

  fs.writeFileSync(path.resolve(__dirname, FOLDER, 'firestore-users.json'), JSON.stringify(users, null, 2))
}
