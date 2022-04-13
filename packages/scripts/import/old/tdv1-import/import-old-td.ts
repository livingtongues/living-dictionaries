import * as fs from 'fs-extra';
import { environment } from './config';
import { unzipArchive } from './helpers/unzip';
import { findUnmatchedPOS } from './helpers/find-unmatched-pos';
import { importToFirebase } from './helpers/import-to-firebase';
import { findLanguages } from './helpers/find-languages';
import { mockDictionary } from './dev/mock-dictionary';
import { deleteDuplicateEntries } from './helpers/delete-duplicate-entries';
import { cleanUpData } from './helpers/clean-up-data';

// const language = process.argv[2];
const dryRun = Boolean(process.argv[2] === 'dryRun');

if (dryRun) {
  console.log('Doing a dry run');
}

const iterateThroughDictionaries = async () => {
  const languages = [
    // 'ho', // - POS? // check lang: '\nriping', and lang: '\ngur', http://ho.swarthmore.edu/?fields=all&semantic_ids=&q=gur
    // 'kera-mundari', // (changed zip from kera_mundari to match kera-mundari url) and missing audio file because of question mark
    // 'olukumi', // convert "ib" to "ig" for "Igbo"
    // 'jakalteko', // don't have data
    // 'wayuunaiki', // changed zip from wayuu to wayuunaiki (old url was wayuu)
    // 'herero', // no data
    // 'gana', // no data
    // 'kgalagadi', // no data
    // 'yeyi', // no data
    // No geo data below here...
    // 'aren-aiome', // changed zip to aren-aiome to match url
    // 'kuman',
    // 'idio-titan', // changed zip from idio_titan to idio-titan to match site url
    // 'kewapi', // no data
    // 'muyuw-woodlark', // changed zip to muyuw-woodlark to match url
    // 'naasioi',
    // 'nalik',
    // 'waskia', // no data
    // 'weri',
    // 'wahgi-waghi', // changed zip to wahgi-waghi to match url
    // 'monkox-besiro-chiquitano', // changed zip from chiquitano
    // 'ishir-chamacoco', // changed zip from chamacoco
    // 'siletz-dee-ni' // changed from siletz
  ];

  // let allUnmatchedPOS = new Set<string>();

  for (const language of languages) {
    let dictionaryId = language;
    const dateStamp = Date.now();
    // if (environment === 'dev') {
    //     dictionaryId = dictionaryId + '-' + dateStamp;
    // }

    const util = require('util');
    const logFile = fs.createWriteStream(`logs/import-${dictionaryId}-${environment}.txt`, {
      flags: 'w',
    }); // 'a' to append, 'w' to write over file contents
    const logStdout = process.stdout;
    console.log = function () {
      logFile.write(util.format.apply(null, arguments) + '\n');
      logStdout.write(util.format.apply(null, arguments) + '\n');
    };
    await importOldTalkingDictionary(dictionaryId, language, dateStamp, dryRun);

    // For POS dry runs
    // const unmatchedPOS = await importOldTalkingDictionary(dictionaryId, language, dateStamp, dryRun);
    // if (unmatchedPOS) {
    //     unmatchedPOS.forEach(pos => allUnmatchedPOS.add(pos));
    // }
  }
  // allUnmatchedPOS.forEach(pos => console.log(pos));
};

const importOldTalkingDictionary = async (
  dictionaryId: string,
  language: string,
  dateStamp: number,
  dryRun: boolean
) => {
  try {
    console.log(`Importing ${dictionaryId}`);
    const dataFileName = await unzipArchive(language, dictionaryId, 'old-td');
    let data = await fs.readJSON(`dictionary/${dictionaryId}/data/${dataFileName}`);
    data = cleanUpData(data);
    findUnmatchedPOS(data); // return here for POS dry runs
    data = deleteDuplicateEntries(data);
    // if (environment === 'dev') {
    //     const glossLanguages: string[] = findLanguages(data);
    //     if (!dryRun) {
    //         await mockDictionary(dictionaryId, glossLanguages)
    //     }
    // }
    const importedCount = await importToFirebase(data, dictionaryId, environment, dryRun);
    console.log(
      `Finished importing ${importedCount} entries to ${environment}/${language} in ${
        (Date.now() - dateStamp) / 1000
      } seconds`
    );
    return true;
  } catch (err) {
    console.error(err);
    throw new Error(err);
  }
};

iterateThroughDictionaries();
