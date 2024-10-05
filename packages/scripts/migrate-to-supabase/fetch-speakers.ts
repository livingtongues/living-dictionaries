import fs from 'node:fs'
import path, { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ISpeaker } from '@living-dictionaries/types'
import { db } from '../config-firebase'

write_speakers()

async function write_speakers() {
  const speakers: ISpeaker[] = []

  const speaker_snapshots = await db.collection('speakers').get()

  for (const speaker_snap of speaker_snapshots.docs) {
    const speaker = { id: speaker_snap.id, ...(speaker_snap.data() as ISpeaker) }
    speakers.push(speaker)
  }

  console.log(`Done fetching ${speakers.length} speakers.`)

  const __dirname = dirname(fileURLToPath(import.meta.url))
  fs.writeFileSync(path.resolve(__dirname, 'speakers.json'), JSON.stringify(speakers, null, 2))
}
