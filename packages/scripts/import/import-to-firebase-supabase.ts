import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import type { ActualDatabaseEntry, ContentUpdateRequestBody, ISpeaker } from '@living-dictionaries/types'
import type { Timestamp } from 'firebase/firestore'
import { db, environment, timestamp } from '../config-firebase.js'
import type { ContentUpdateResponseBody } from '../../site/src/routes/api/db/content-update/+server'
import { uploadAudioFile, uploadImageFile } from './import-media.js'
import { parseCSVFrom } from './parse-csv.js'
import { post_request } from './post-request.js'
import { convert_row_to_objects_for_databases } from './convert_row_to_objects_for_databases.js'
import type { Row } from './row.type'

const supabase_content_update_endpoint = 'http://localhost:3041/api/db/content-update'
const dev_developer_in_charge_supabase_uid = '12345678-abcd-efab-cdef-123456789013' // in Supabase diego@livingtongues.org -> Diego Córdova Nieto;
const prod_developer_in_charge_supabase_uid = 'be43b1dd-6c64-494d-b5da-10d70c384433' // in Supabase diego@livingtongues.org -> Diego Córdova Nieto;
const user_id_from_local = environment === 'dev' ? dev_developer_in_charge_supabase_uid : prod_developer_in_charge_supabase_uid

const developer_in_charge_firebase_uid = 'qkTzJXH24Xfc57cZJRityS6OTn52' // diego@livingtongues.org -> Diego Córdova Nieto;

export async function importFromSpreadsheet({ dictionaryId, live }: { dictionaryId: string, live: boolean }) {
  const dateStamp = Date.now()
  const import_id = `v4-${dateStamp}`

  const file = readFileSync(`./import/data/${dictionaryId}/${dictionaryId}.csv`, 'utf8')
  const rows = parseCSVFrom<Row>(file)
  const entries = await importEntries(dictionaryId, rows, import_id, live)

  console.log(
    `Finished ${live ? 'importing' : 'emulating'} ${entries.length} entries to ${environment === 'dev' ? 'http://localhost:3041/' : 'livingdictionaries.app/'
    }${dictionaryId} in ${(Date.now() - dateStamp) / 1000} seconds`,
  )
  console.log('') // line break
  return entries
}

export async function importEntries(
  dictionary_id: string,
  rows: Row[],
  import_id: string,
  live = false,
): Promise<ActualDatabaseEntry[]> {
  const firebase_entries: ActualDatabaseEntry[] = []
  let entryCount = 0
  let batchCount = 0
  let batch = db.batch()
  const colRef = db.collection(`dictionaries/${dictionary_id}/words`)

  const speaker_snapshots = (await db.collection('speakers').where('contributingTo', 'array-contains', dictionary_id).get()).docs
  const speakers = speaker_snapshots.map((snap) => {
    return { id: snap.id, ...(snap.data() as ISpeaker) }
  })

  for (const row of rows) {
    if (!row.lexeme || row.lexeme === '(word/phrase)')
      continue

    if (live && batchCount === 200) {
      console.log('Committing batch of entries ending with: ', entryCount)
      await batch.commit()
      batch = db.batch()
      batchCount = 0
    }

    const universal_entry_id = colRef.doc().id

    const { firebase_entry, supabase_senses, supabase_sentences } = convert_row_to_objects_for_databases({ row, import_id, timestamp })

    for (const { sense, sense_id } of supabase_senses) {
      await update_sense({ entry_id: universal_entry_id, dictionary_id, sense, sense_id, live, import_id })
    }
    for (const { sentence, sentence_id, sense_id } of supabase_sentences) {
      await update_sentence({ entry_id: universal_entry_id, dictionary_id, sentence, sense_id, sentence_id, live, import_id })
    }

    if (row.photoFile) {
      const pf = await uploadImageFile(row.photoFile, universal_entry_id, dictionary_id, live)
      if (pf) firebase_entry.pf = pf
    }

    if (row.soundFile) {
      const audioFilePath = await uploadAudioFile(row.soundFile, universal_entry_id, dictionary_id, live)
      firebase_entry.sf = {
        path: audioFilePath,
        ts: Date.now(),
      }

      if (row.speakerName) {
        const speaker: ISpeaker = speakers.find(speaker => speaker.displayName === row.speakerName)
        if (speaker) {
          firebase_entry.sf.sp = speaker.id
        } else {
          const new_speaker: ISpeaker = {
            displayName: row.speakerName,
            birthplace: row.speakerHometown || '',
            decade: Number.parseInt(row.speakerAge) || null,
            gender: row.speakerGender as 'm' | 'f' | 'o' || null,
            contributingTo: [dictionary_id],
            createdAt: timestamp as Timestamp,
            createdBy: developer_in_charge_firebase_uid,
            updatedAt: timestamp as Timestamp,
            updatedBy: developer_in_charge_firebase_uid,
          }
          if (live) {
            const new_speaker_id = await db.collection('speakers').add(new_speaker).then(ref => ref.id)
            firebase_entry.sf.sp = new_speaker_id
            speakers.push({ id: new_speaker_id, ...new_speaker })
          }
        }
      }
    }

    firebase_entries.push(firebase_entry)
    batch.create(colRef.doc(universal_entry_id), firebase_entry)
    batchCount++
    entryCount++
  }

  console.log(`Committing final batch of entries ending with: ${entryCount}`)
  if (live) await batch.commit()
  return firebase_entries
}

export async function update_sense({
  entry_id,
  dictionary_id,
  sense,
  sense_id,
  live,
  import_id,
}: {
  entry_id: string
  dictionary_id: string
  sense: ContentUpdateRequestBody['change']['sense']
  sense_id: string
  live: boolean
  import_id: string
}) {
  if (!live) return console.log({ dry_sense: sense })

  const { data, error } = await post_request<ContentUpdateRequestBody, ContentUpdateResponseBody>(supabase_content_update_endpoint, {
    id: randomUUID(),
    auth_token: null,
    user_id_from_local,
    dictionary_id,
    entry_id,
    timestamp: new Date().toISOString(),
    sense_id,
    table: 'senses',
    change: {
      sense,
    },
    import_id,
  })

  if (error) {
    console.error('Error inserting into Supabase: ', error)
    throw new Error(error.message)
  }

  console.log({ data })

  return true
}

export async function update_sentence({
  entry_id,
  dictionary_id,
  sentence,
  sense_id,
  sentence_id,
  live,
  import_id,
}: {
  entry_id: string
  dictionary_id: string
  sentence: ContentUpdateRequestBody['change']['sentence']
  sense_id: string
  sentence_id: string
  live: boolean
  import_id: string
}) {
  if (!live) return console.log({ dry_sense: sentence })

  const { data, error } = await post_request<ContentUpdateRequestBody, ContentUpdateResponseBody>(supabase_content_update_endpoint, {
    id: randomUUID(),
    auth_token: null,
    user_id_from_local,
    dictionary_id,
    entry_id,
    timestamp: new Date().toISOString(),
    sense_id,
    sentence_id,
    table: 'sentences',
    change: {
      sentence,
    },
    import_id,
  })

  if (error) {
    console.error('Error inserting into Supabase: ', error)
    throw new Error(error.message)
  }

  console.log({ data })

  return true
}

// Current flow: (out of date - needs updated)
// Use Firebase to import entry as is already written (import-spreadsheet-v4.ts) including 1st sense, but check the import data for additional senses. If so then do the below flow at that point using a simple function call.
// use that entry id to add additional senses to Supabase via entry_updates (seen in routes\api\db\change\entry\+server.ts and lib\supabase\change\sense.ts) - one update for ps, one for gloss
// add example sentence to new table (Jacob will create, so it doesn't exist yet)
// add another entry_update to connect that example sentence id to the sense

// Future Supabase-only flow - ignore for now
// Import entry into imports table, after which a trigger edge function will create the entry, get the entry id
// use that entry id to add senses via entry_updates
// add example sentence to new table (doesn't exist yet)
// add entry_update to connect that example sentence to the sense
