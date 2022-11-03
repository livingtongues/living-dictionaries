import { IEntry } from '@living-dictionaries/types';
import { db } from '../config';
import { program } from 'commander';
program
  //   .version('0.0.1')
  .option('--id <value>', 'Dictionary Id')
  .option('--live', 'If not included, only log values')
  .parse(process.argv);

const dictionaryId = program.opts().id;
const live = program.opts().live;

async function entryRefactor() {
  try {
    if (dictionaryId) {
      console.log(`---Refactoring: ${dictionaryId}`);
      fetchEntries(dictionaryId);
    } else {
      db.collection('dictionaries')
        .get()
        .then((snapshot) => {
          snapshot.forEach((dictionary) => {
            console.log('--------------------Refactoring: ');
            console.log(dictionary.id);
            fetchEntries(dictionary.id);
          });
        });
    }
  } catch (error) {
    console.log('Refactor failed!', error);
  }
}

function fetchEntries(dictionaryId: string) {
  db.collection(`dictionaries/${dictionaryId}/words`)
    .get()
    .then((snapshot) => {
      snapshot.forEach(async (snap) => {
        const entry: IEntry = { id: snap.id, ...(snap.data() as IEntry) };
        // await turnSDintoArray(dictionaryId, entry);
        // await refactorGloss(dictionaryId, entry);
        // await notesToPluralForm(dictionaryId, entry);
        await turnPOSintoArray(dictionaryId, entry);
      });
    });
}

const turnSDintoArray = async (dictionaryId: string, entry: IEntry) => {
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

const turnPOSintoArray = async (dictionaryId: string, entry: IEntry) => {
  if (entry.ps && typeof entry.ps === 'string') {
    console.log('entry ps before:');
    console.log(entry.ps);
    const emptyArray: string[] = [];
    emptyArray.push(entry.ps);
    entry.ps = emptyArray;
    console.log('entry ps after:');
    console.log(entry.ps);
  } else if (entry.ps && entry.ps instanceof Array) {
    console.log('it is an array - do nothing');
  } else {
    delete entry.ps;
  }
  if (!live) return;
  await db.collection(`dictionaries/${dictionaryId}/words`).doc(entry.id).set(entry);
  return true;
};

const refactorGloss = async (dictionaryId: string, entry: IEntry) => {
  console.log(entry.gl);
  for (const key in entry.gl) {
    if (key === 'English') {
      entry.gl['en'] = entry.gl[key];
      delete entry.gl[key];
    }
    if (key === 'Spanish') {
      entry.gl['es'] = entry.gl[key];
      delete entry.gl[key];
    }
    if (key === 'Español') {
      entry.gl['es'] = entry.gl[key];
      delete entry.gl[key];
    }
    if (key === 'Bahasa Indonesia') {
      entry.gl['id'] = entry.gl[key];
      delete entry.gl[key];
    }
    if (key === 'French') {
      entry.gl['fr'] = entry.gl[key];
      delete entry.gl[key];
    }
    if (key === 'Mandarin 中文') {
      entry.gl['cmn'] = entry.gl[key];
      delete entry.gl[key];
    }
  }
  if (!live) return;
  await db.collection(`dictionaries/${dictionaryId}/words`).doc(entry.id).set(entry);
  return console.log(`${entry.id}: `, entry.gl);
};

// `pnpm entryRefactor --id babanki` to log refactor in dev
// `pnpm entryRefactor --id babanki --live` to do refactor in dev
// `pnpm entryRefactor --id babanki -e prod` to log refactor in prod
// `pnpm entryRefactor --id babanki --live -e prod` to do refactor in prod
const notesToPluralForm = async (dictionaryId: string, entry: IEntry) => {
  const ntBefore = entry.nt;
  if (entry.nt && entry.nt.startsWith('Plural form:')) {
    entry.pl = entry.nt.replace('Plural form: ', '');
    delete entry.nt;
    console.log(`${entry.id}, ntBefore:${ntBefore}, ntAfter:${entry.nt}, pl:${entry.pl}`);
  }
  if (!live) return;
  await db.collection(`dictionaries/${dictionaryId}/words`).doc(entry.id).set(entry);
  return true;
};

entryRefactor();
