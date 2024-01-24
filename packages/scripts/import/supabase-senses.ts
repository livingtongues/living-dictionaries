import type { ActualDatabaseEntry } from '@living-dictionaries/types';
import { db, timestamp, environment } from '../config.js';
import { uploadAudioFile, uploadImageFile } from './import-media.js';
import { readFileSync } from 'fs';
import { parseCSVFrom } from './parse-csv.js';
import { convertJsonRowToEntryFormat } from './convertJsonRowToEntryFormat.js';

const developer_in_charge = 'qkTzJXH24Xfc57cZJRityS6OTn52'; // diego@livingtongues.org -> Diego Córdova Nieto;
type unique_speakers = Record<string, string>;
const different_speakers: unique_speakers = {};

export async function importFromSpreadsheet(dictionaryId: string, dry = false) {
  const dateStamp = Date.now();

  const file = readFileSync(`./import/data/${dictionaryId}/${dictionaryId}.csv`, 'utf8');
  const rows = parseCSVFrom(file);
  const entries = await importEntriesToFirebase(dictionaryId, rows, dateStamp, dry);

  console.log(
    `Finished ${dry ? 'emulating' : 'importing'} ${entries.length} entries to ${
      environment === 'dev' ? 'http://localhost:3041/' : 'livingdictionaries.app/'
    }${dictionaryId} in ${(Date.now() - dateStamp) / 1000} seconds`
  );
  console.log('');
  return entries;
}

export async function importEntriesToFirebase(
  dictionaryId: string,
  rows: any[],
  dateStamp: number,
  dry = false
) {
  const entries: ActualDatabaseEntry[] = [];
  let entryCount = 0;
  let batchCount = 0;
  let batch = db.batch();
  const colRef = db.collection(`dictionaries/${dictionaryId}/words`);
  let speakerRef;
  let speakerId;

  for (const row of rows) {
    if (!row.lexeme || row.lexeme === '(word/phrase)')
      continue;

    if (!dry && batchCount === 200) {
      console.log('Committing batch of entries ending with: ', entryCount);
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }

    const entryId = colRef.doc().id;
    // It's now duplicated
    const sense_regex = /^s\d+_/;
    const entry = Object.keys(row).some(key => sense_regex.test(key)) ? convertJsonRowToEntryFormat({row, dateStamp, timestamp}, {entry_id: entryId, dictionary_id: dictionaryId}) : convertJsonRowToEntryFormat({row, dateStamp, timestamp});

    if (row.photoFile) {
      const pf = await uploadImageFile(row.photoFile, entryId, dictionaryId, dry);
      if (pf) entry.pf = pf;
    }

    if (row.soundFile) {
      speakerRef = db.collection('speakers');
      if (row.speakerName && (!speakerId || !(row.speakerName in different_speakers))) {
        speakerId = speakerRef.doc().id;
        different_speakers[row.speakerName] = speakerId;
        batch.create(speakerRef.doc(speakerId), {
          displayName: row.speakerName,
          birthplace: row.speakerHometown || '',
          decade: parseInt(row.speakerAge) || '',
          gender: row.speakerGender || '',
          contributingTo: [dictionaryId],
          createdAt: timestamp,
          createdBy: developer_in_charge,
          updatedAt: timestamp,
          updatedBy: developer_in_charge,
        });
      }
      const audioFilePath = await uploadAudioFile(row.soundFile, entryId, dictionaryId, dry);
      if (audioFilePath) {
        entry.sf = {
          path: audioFilePath,
          ts: timestamp,
        };
        if (speakerId)
          entry.sf.sp = different_speakers[row.speakerName];
        else
          entry.sf.speakerName = row.speakerName; // Keep that if for some reason we need the speakername as text only again.

      }
    }

    entries.push(entry);
    batch.create(colRef.doc(entryId), entry);
    batchCount++;
    entryCount++;
  }
  console.log(`Committing final batch of entries ending with: ${entryCount}`);
  if (!dry) await batch.commit();
  return entries;
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
