import fs from 'node:fs'
import path, { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ActualDatabaseEntry } from '@living-dictionaries/types'
import { db } from '../config-firebase'

write_entries()

async function write_entries() {
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

  const __dirname = dirname(fileURLToPath(import.meta.url))
  fs.writeFileSync(path.resolve(__dirname, 'entries.json'), JSON.stringify(entries, null, 2))
}
