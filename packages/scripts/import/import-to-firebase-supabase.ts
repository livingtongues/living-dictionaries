import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import type { ActualDatabaseEntry, ContentUpdateRequestBody } from '@living-dictionaries/types'
import { db, environment, timestamp } from '../config-firebase.js'
import { uploadAudioFile, uploadImageFile } from './import-media.js'
import { parseCSVFrom } from './parse-csv.js'
import { convertJsonRowToEntryFormat } from './convertJsonRowToEntryFormat.js'
import { post_request } from './post-request.js'
import { convert_row_to_objects_for_databases } from './convert_row_to_objects_for_databases.js'

const supbase_content_update_endpoint = 'http://localhost:3041/api/db/content-update'
const developer_in_charge_supabase_uid = '12345678-abcd-efab-cdef-123456789013' // in Supabase diego@livingtongues.org -> Diego Córdova Nieto;
const developer_in_charge_firebase_uid = 'qkTzJXH24Xfc57cZJRityS6OTn52' // diego@livingtongues.org -> Diego Córdova Nieto;
type unique_speakers = Record<string, string>
const different_speakers: unique_speakers = {}

export async function importFromSpreadsheet(dictionaryId: string, dry = false) {
  const dateStamp = Date.now()

  const file = readFileSync(`./import/data/${dictionaryId}/${dictionaryId}.csv`, 'utf8')
  const rows = parseCSVFrom(file)
  const entries = await importEntries(dictionaryId, rows, dateStamp, dry)

  console.log(
    `Finished ${dry ? 'emulating' : 'importing'} ${entries.length} entries to ${
      environment === 'dev' ? 'http://localhost:3041/' : 'livingdictionaries.app/'
    }${dictionaryId} in ${(Date.now() - dateStamp) / 1000} seconds`,
  )
  console.log('')
  return entries
}

export async function importEntries(
  dictionary_id: string,
  rows: any[],
  dateStamp: number,
  dry = false,
) {
  const firebase_entries: ActualDatabaseEntry[] = []
  let entryCount = 0
  let batchCount = 0
  let batch = db.batch()
  const colRef = db.collection(`dictionaries/${dictionary_id}/words`)
  let speakerRef
  let speakerId

  for (const row of rows) {
    if (!row.lexeme || row.lexeme === '(word/phrase)')
      continue

    if (!dry && batchCount === 200) {
      console.log('Committing batch of entries ending with: ', entryCount)
      await batch.commit()
      batch = db.batch()
      batchCount = 0
    }

    const universal_entry_id = colRef.doc().id

    const { firebase_entry, supabase_senses, supabase_sentences } = convert_row_to_objects_for_databases ({ row, dateStamp, timestamp })

    for (const { sense, sense_id } of supabase_senses) {
      await update_sense({ entry_id: universal_entry_id, dictionary_id, sense, sense_id, dry })
    }
    for (const { sentence, sentence_id, sense_id } of supabase_sentences) {
      await update_sentence({ entry_id: universal_entry_id, dictionary_id, sentence, sense_id, sentence_id, dry })
    }

    if (row.photoFile) {
      const pf = await uploadImageFile(row.photoFile, universal_entry_id, dictionary_id, dry)
      if (pf) firebase_entry.pf = pf
    }

    if (row.soundFile) {
      speakerRef = db.collection('speakers')
      if (row.speakerName && (!speakerId || !(row.speakerName in different_speakers))) {
        speakerId = speakerRef.doc().id
        different_speakers[row.speakerName] = speakerId
        batch.create(speakerRef.doc(speakerId), {
          displayName: row.speakerName,
          birthplace: row.speakerHometown || '',
          decade: Number.parseInt(row.speakerAge) || '',
          gender: row.speakerGender || '',
          contributingTo: [dictionary_id],
          createdAt: timestamp,
          createdBy: developer_in_charge_firebase_uid,
          updatedAt: timestamp,
          updatedBy: developer_in_charge_firebase_uid,
        })
      }
      const audioFilePath = await uploadAudioFile(row.soundFile, universal_entry_id, dictionary_id, dry)
      if (audioFilePath) {
        firebase_entry.sf = {
          path: audioFilePath,
          ts: timestamp,
        }
        if (speakerId)
          firebase_entry.sf.sp = different_speakers[row.speakerName]
        else
          firebase_entry.sf.speakerName = row.speakerName // Keep that if for some reason we need the speakername as text only again.
      }
    }

    firebase_entries.push(firebase_entry)
    batch.create(colRef.doc(universal_entry_id), firebase_entry)
    batchCount++
    entryCount++
  }
  console.log(`Committing final batch of entries ending with: ${entryCount}`)
  if (!dry) await batch.commit()
  return firebase_entries
}

export async function update_sense({
  entry_id,
  dictionary_id,
  sense,
  sense_id,
  dry,
}: {
  entry_id: string
  dictionary_id: string
  sense: ContentUpdateRequestBody['change']['sense']
  sense_id: string
  dry: boolean
}) {
  if (!dry) return console.log({ dry_sense: sense })

  const { error } = await post_request<ContentUpdateRequestBody>(supbase_content_update_endpoint, {
    id: randomUUID(),
    auth_token: null,
    user_id_from_local: developer_in_charge_supabase_uid,
    dictionary_id,
    entry_id,
    timestamp: new Date().toISOString(),
    sense_id,
    table: 'senses',
    change: {
      sense,
    },
    import_id: null, // TODO: add this - should match the one used in firebase entries
  })

  if (error) {
    console.error('Error inserting into Supabase: ', error)
    throw error
  }

  return true
}

export async function update_sentence({
  entry_id,
  dictionary_id,
  sentence,
  sense_id,
  sentence_id,
  dry,
}: {
  entry_id: string
  dictionary_id: string
  sentence: ContentUpdateRequestBody['change']['sentence']
  sense_id: string
  sentence_id: string
  dry: boolean
}) {
  if (!dry) return console.log({ dry_sense: sentence })

  const { error } = await post_request<ContentUpdateRequestBody>(supbase_content_update_endpoint, {
    id: randomUUID(),
    auth_token: null,
    user_id_from_local: developer_in_charge_supabase_uid,
    dictionary_id,
    entry_id,
    timestamp: new Date().toISOString(),
    sense_id,
    sentence_id,
    table: 'sentences',
    change: {
      sentence,
    },
    import_id: null, // TODO: add this - should match the one used in firebase entries
  })

  if (error) {
    console.error('Error inserting into Supabase: ', error)
    throw error
  }

  return true
}

// Current flow:
// Use Firebase to import entry as is already written (import-spreadsheet-v4.ts) including 1st sense, but check the import data for additional senses. If so then do the below flow at that point using a simple function call.
// use that entry id to add additional senses to Supabase via entry_updates (seen in routes\api\db\change\entry\+server.ts and lib\supabase\change\sense.ts) - one update for ps, one for gloss
// add example sentence to new table (Jacob will create, so it doesn't exist yet)
// add another entry_update to connect that example sentence id to the sense

// Future Supabase-only flow - ignore for now
// Import entry into imports table, after which a trigger edge function will create the entry, get the entry id
// use that entry id to add senses via entry_updates
// add example sentence to new table (doesn't exist yet)
// add entry_update to connect that example sentence to the sense
