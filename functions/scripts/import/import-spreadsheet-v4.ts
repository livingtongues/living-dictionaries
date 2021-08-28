// import * as csv from 'csvtojson';
const csv = require('csvtojson');
import { db, timestamp, environment } from '../config';
import type { IEntry } from '../../../src/lib/interfaces';

export async function importFromSpreadsheet(dictionaryId: string) {
  const dateStamp = Date.now();

  const json = await loadJSONfromCSV(dictionaryId);
  const entries = convertJsonToEntries(json, dateStamp);
  await importEntriesToFirebase(dictionaryId, entries);

  console.log(
    `Finished importing ${entries.length} entries to ${
      environment === 'dev' ? 'http://localhost:3041/' : 'livingdictionaries.app/'
    }${dictionaryId} in ${(Date.now() - dateStamp) / 1000} seconds`
  );
  return entries;
}

export async function loadJSONfromCSV(dictionaryId: string) {
  return await csv().fromFile(`./scripts/import/spreadsheets/${dictionaryId}.csv`);
}

export function convertJsonToEntries(json: any[], dateStamp: number): IEntry[] {
  const entries: IEntry[] = [];
  for (const row of json) {
    if (!row.lexeme || row.lexeme === '(word/phrase)') {
      continue;
    }
    const entry: IEntry = { lx: row.lexeme, gl: {}, xs: {} };

    Boolean(row.phonetic) && (entry.ph = row.phonetic);
    Boolean(row.morphology) && (entry.mr = row.morphology);
    Boolean(row.interlinearization) && (entry.in = row.interlinearization);
    Boolean(row.partOfSpeech) && (entry.ps = row.partOfSpeech);
    Boolean(row.dialect) && (entry.di = row.dialect);
    if (row.semanticDomain || row.semanticDomain2) {
      entry.sdn = [];
      Boolean(row.semanticDomain) && entry.sdn.push(row.semanticDomain.toString());
      Boolean(row.semanticDomain2) && entry.sdn.push(row.semanticDomain2.toString());
    }
    Boolean(row.semanticDomain_custom) && (entry.sd = row.semanticDomain_custom);
    Boolean(row.ID) && (entry.ei = row.ID);

    Boolean(row.localOrthography) && (entry.lo = row.localOrthography);
    Boolean(row.localOrthography2) && (entry.lo2 = row.localOrthography2);
    Boolean(row.localOrthography3) && (entry.lo3 = row.localOrthography3);
    Boolean(row.localOrthography4) && (entry.lo4 = row.localOrthography4);
    Boolean(row.localOrthography5) && (entry.lo5 = row.localOrthography5);

    Boolean(row.notes) && (entry.nt = row.notes);
    // Notes parsing for Opata
    // if (row.notes) {
    //     const parsedNotes = parseSourceFromNotes(row.notes);
    //     Boolean(parsedNotes.notes) && (entry.nt = parsedNotes.notes);
    //     Boolean(parsedNotes.source) && (entry.sr = [parsedNotes.source]);
    // }

    Object.keys(row).forEach((key) => {
      // gloss fields are labeled using bcp47 language codes followed by '_gloss' (e.g. es_gloss, tpi_gloss)
      if (key.includes('_gloss') && row[key]) {
        const language = key.split('_gloss')[0];
        entry.gl[language] = row[key];
        return;
      }

      if (key.includes('vernacular_exampleSentence') && row[key]) {
        return (entry.xs['vn'] = row[key]);
      }

      // example sentence fields are codes followed by '_exampleSentence'
      if (key.includes('_exampleSentence') && row[key]) {
        const language = key.split('_exampleSentence')[0];
        entry.xs[language] = row[key];
      }
    });
    if (Object.keys(entry.xs).length === 0) {
      delete entry.xs;
    }

    entry.ii = `v4-${dateStamp}`;
    // @ts-ignore
    entry.ca = timestamp;
    // @ts-ignore
    entry.ua = timestamp;

    entries.push(entry);
  }
  return entries;
}

export function parseSourceFromNotes(notes: string): { notes: string; source?: string } {
  const matches = notes.match(/([\s\S]*)Source:([\s\S]*)/);
  if (matches) {
    return {
      notes: matches[1].trim().replace(/\s+/g, ' '),
      source: matches[2].trim().replace(/\s+/g, ' '),
    };
  } else {
    return { notes };
  }
}

export async function importEntriesToFirebase(dictionaryId: string, entries: IEntry[]) {
  let entryCount = 0;
  let batchCount = 0;
  let batch = db.batch();
  const colRef = db.collection(`dictionaries/${dictionaryId}/words`);

  for (const entry of entries) {
    if (batchCount === 200) {
      console.log('Committing batch of entries ending with: ', entryCount);
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
    batch.create(colRef.doc(), entry);
    batchCount++;
    entryCount++;
  }
  console.log('Committing final batch of entries ending with: ', entryCount);
  await batch.commit();
}
