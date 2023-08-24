import { ActualDatabaseEntry } from '@living-dictionaries/types';
import { db } from '../config';
import { program } from 'commander';
import { reverse_semantic_domains_mapping } from './reverse-semantic-domains-mapping';
import { turn_dialect_strings_to_arrays } from './turn-dialects-to-arrays';
program
  //   .version('0.0.1')
  .option('--id <value>', 'Dictionary Id')
  .option('--live', 'If not included, only log values')
  .parse(process.argv);

const dictionaryId = program.opts().id;
const {live} = program.opts();

async function entryRefactor() {
  try {
    if (dictionaryId) {
      console.log(`---Refactoring: ${dictionaryId}`);
      await fetchEntries(dictionaryId);
    } else {
      const snapshot = await db.collection('dictionaries').get();
      for (const dictionarySnap of snapshot.docs) {
        // If setting limits on refactoring, you can skip dictionaries beginning with letters that have already been processed:
        const done = /^[abcdefghijklmn].*/;
        if (!done.test(dictionarySnap.id.toLowerCase())) {
          console.log(`---Refactoring: ${dictionarySnap.id}`);
          await fetchEntries(dictionarySnap.id);
        }
      }
    }
  } catch (error) {
    console.error('Refactor failed!');
    console.error(error);
  }
}

async function fetchEntries(dictionaryId: string) {
  const snapshot = await db.collection(`dictionaries/${dictionaryId}/words`).get();
  for (const snap of snapshot.docs) {
    const entry: ActualDatabaseEntry = { id: snap.id, ...(snap.data() as ActualDatabaseEntry) };
    // await turnSDintoArray(dictionaryId, entry);
    // await refactorGloss(dictionaryId, entry);
    // await notesToPluralForm(dictionaryId, entry);
    // turnPOSintoArray(dictionaryId, entry); // not awaiting so operations can run in parallel otherwise the function errors after about 1400 iterations
    // reverese_semantic_domains_in_db(dictionaryId, entry);
    turnDialectsIntoArray(dictionaryId, entry);
  }
}

const turnDialectsIntoArray = async (dictionaryId: string, entry: ActualDatabaseEntry) => {
  if (entry.di) {
    console.log('entry dialect before:');
    console.log(entry.di);
    if (Array.isArray(entry.di))
      return true;

    entry.di =  turn_dialect_strings_to_arrays(entry.di);
    console.log('entry dialect after:');
    console.log(entry.di);
    if (!live) return;
    await db.collection(`dictionaries/${dictionaryId}/words`).doc(entry.id).set(entry);
  }
  return true;
};

const reverese_semantic_domains_in_db = async (dictionaryId: string, entry: ActualDatabaseEntry) => {
  if (entry.sdn) {
    console.log('entry sdn before:');
    console.log(entry.sdn);
    entry.sdn = reverse_semantic_domains_mapping(entry.sdn);
  }
  console.log('entry sdn after:');
  console.log(entry.sdn);
  if (!live) return;
  await db.collection(`dictionaries/${dictionaryId}/words`).doc(entry.id).set(entry);
  return true;
};

const turnSDintoArray = async (dictionaryId: string, entry: ActualDatabaseEntry) => {
  if (entry.sd && typeof entry.sd === 'string') {
    console.log('entry sd before: ', entry.sd);
    const emptyArray: string[] = [];
    emptyArray.push(entry.sd);
    entry.sd = emptyArray;
    console.log('entry sd after: ', entry.sd);
  } else if (entry.sd && entry.sd instanceof Array) {
    console.log('it is an array - do nothing');
  } else {
    delete entry.sd;
  }
  if (!live) return;
  await db.collection(`dictionaries/${dictionaryId}/words`).doc(entry.id).set(entry);
  return true;
};

let count = 1;
const turnPOSintoArray = async (dictionaryId: string, entry: ActualDatabaseEntry) => {
  if (entry.ps && typeof entry.ps === 'string') {
    console.log(`${count}:${dictionaryId}:${entry.id}`);
    console.log(entry.ps);
    entry.ps = [entry.ps];
    console.log(entry.ps);
    count++;
    if (live) await db.collection(`dictionaries/${dictionaryId}/words`).doc(entry.id).set(entry);
    // } else if (entry.ps && entry.ps instanceof Array) {
    //   console.log(`${dictionaryId}:${entry.id} is already an array`);
  }
};

const refactorGloss = async (dictionaryId: string, entry: ActualDatabaseEntry) => {
  console.log(entry.gl);
  for (const key in entry.gl) {
    if (key === 'English') {
      entry.gl.en = entry.gl[key];
      delete entry.gl[key];
    }
    if (key === 'Spanish') {
      entry.gl.es = entry.gl[key];
      delete entry.gl[key];
    }
    if (key === 'Español') {
      entry.gl.es = entry.gl[key];
      delete entry.gl[key];
    }
    if (key === 'Bahasa Indonesia') {
      entry.gl.id = entry.gl[key];
      delete entry.gl[key];
    }
    if (key === 'French') {
      entry.gl.fr = entry.gl[key];
      delete entry.gl[key];
    }
    if (key === 'Mandarin 中文') {
      entry.gl.cmn = entry.gl[key];
      delete entry.gl[key];
    }
  }
  if (!live) return;
  await db.collection(`dictionaries/${dictionaryId}/words`).doc(entry.id).set(entry);
  return console.log(`${entry.id}: `, entry.gl);
};

const notesToPluralForm = async (dictionaryId: string, entry: ActualDatabaseEntry) => {
  const ntBefore = entry.nt;
  if (entry?.nt.startsWith('Plural form:')) {
    entry.pl = entry.nt.replace('Plural form: ', '');
    delete entry.nt;
    console.log(`${entry.id}, ntBefore:${ntBefore}, ntAfter:${entry.nt}, pl:${entry.pl}`);
  }
  if (!live) return;
  await db.collection(`dictionaries/${dictionaryId}/words`).doc(entry.id).set(entry);
  return true;
};

entryRefactor();

// Single Dictionary
// `pnpm entryRefactor --id babanki` to log refactor in dev
// `pnpm entryRefactor --id babanki --live` to do refactor in dev
// `pnpm entryRefactor --id babanki -e prod` to log refactor in prod
// `pnpm entryRefactor --id babanki --live -e prod` to do refactor in prod

// All dictionaries
// `pnpm entryRefactor` to log refactor in dev
// `pnpm entryRefactor --live` to do refactor in dev
// `pnpm entryRefactor -e prod` to log refactor in prod
// `pnpm entryRefactor --live -e prod` to do refactor in prod
