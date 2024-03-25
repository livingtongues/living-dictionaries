import * as fs from 'fs-extra';
import { environment } from './config-firebase';
import * as xlsx from 'xlsx';
import * as csv from 'csvtojson';
import { importSpreadsheetToFirebase } from './import-spreadsheet-to-firebase';
import { mockDictionary } from './dev/mock-dictionary';

const language = 'kumyk';
let dictionaryId = language;
const dateStamp = Date.now();
// @ts-ignore
if (environment === 'dev') {
  dictionaryId = dictionaryId + '-' + dateStamp;
}
const dryRun = false;

async function importFromSpreadsheet() {
  const util = require('util');
  const logFile = fs.createWriteStream(`logs/import-${dictionaryId}-${environment}.txt`, {
    flags: 'w',
  }); // 'a' to append, 'w' to write over file contents
  const logStdout = process.stdout;
  console.log = function () {
    // eslint-disable-next-line prefer-rest-params
    logFile.write(util.format.apply(null, arguments) + '\n');
    // eslint-disable-next-line prefer-rest-params
    logStdout.write(util.format.apply(null, arguments) + '\n');
  };

  try {
    console.log('importing: ', dictionaryId);
    // const dataFileName = await unzipArchive(language, dictionaryId, 'spreadsheet');
    // console.log('returned: ', dataFileName);
    // let jsonData = await convertXlsxToJson(dataFileName);
    const jsonData = await csv().fromFile(`ready-data/${language}.csv`);

    // @ts-ignore
    if (environment === 'dev') {
      // const glossLanguages: string[] = findLanguages(data);
      const glossLanguages = ['en', 'hi', 'as', 'or'];
      if (!dryRun) {
        await mockDictionary(dictionaryId, glossLanguages);
      }
    }
    const importedCount = await importSpreadsheetToFirebase(
      jsonData,
      dictionaryId,
      environment,
      dateStamp,
      dryRun
    );
    console.log(
      `Finished importing ${importedCount} entries to https://td-${environment}-svelte.web.app/${dictionaryId} in ${
        (Date.now() - dateStamp) / 1000
      } seconds`
    );
    return true;
  } catch (err) {
    console.error(err);
    throw new Error(err);
  }
}

importFromSpreadsheet();

// MOVE INTO HELPERS FOLDER

/**
 * Takes an Excel file and return the first sheet as an array of JSON objects for each row
 */
export const convertXlsxToJson = (dataFileName: string | any) => {
  const workbook = xlsx.readFile(`dictionary/${dictionaryId}/data/${dataFileName}`);
  const sheet_name_list = workbook.SheetNames;
  return xlsx.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);
};
