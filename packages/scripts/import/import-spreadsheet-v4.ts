import type { IEntry } from '@living-dictionaries/types';
import { db, timestamp, environment } from '../config.js';
import { uploadAudioFile, uploadImageFile } from './import-media.js';
import { readFileSync } from 'fs';
import { parseCSVFrom } from './parse-csv.js';
import { convertJsonRowToEntryFormat } from './convertJsonRowToEntryFormat.js';

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
  const entries: IEntry[] = [];
  let entryCount = 0;
  let batchCount = 0;
  let batch = db.batch();
  const colRef = db.collection(`dictionaries/${dictionaryId}/words`);

  for (const row of rows) {
    if (!row.lexeme || row.lexeme === '(word/phrase)') {
      continue;
    }
    if (!dry && batchCount === 200) {
      console.log('Committing batch of entries ending with: ', entryCount);
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }

    const entryId = colRef.doc().id;
    const entry = convertJsonRowToEntryFormat(row, dateStamp, timestamp);

    if (row.photoFile) {
      const pf = await uploadImageFile(row.photoFile, entryId, dictionaryId, dry);
      if (pf) entry.pf = pf;
    }

    if (row.soundFile) {
      const audioFilePath = await uploadAudioFile(row.soundFile, entryId, dictionaryId, dry);
      if (audioFilePath) {
        entry.sf = {
          path: audioFilePath,
          speakerName: row.speakerName,
          ts: timestamp,
        };
      }
    }

    entries.push(entry);
    batch.create(colRef.doc(entryId), entry);
    batchCount++;
    entryCount++;
  }
  console.log(`Committing final batch of entries ending with: ${entryCount}`);
  !dry && (await batch.commit());
  return entries;
}
